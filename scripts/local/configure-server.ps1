[CmdletBinding()]
param(
    [ValidateSet('Menu', 'Create', 'Validate', 'Upload', 'SelfTest')]
    [string]$Action = 'Menu',
    [string]$ConfigPath = '',
    [switch]$Replace,
    [switch]$NonInteractive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $ConfigPath) {
    $ConfigPath = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) '.env.server.local'
}
$script:Utf8 = New-Object System.Text.UTF8Encoding($false, $true)
$script:AllowedKeys = @(
    'NODE_ENV', 'APP_PROFILE', 'HOST', 'PORT', 'DEV_BYPASS_AUTH',
    'VITE_APP_PROFILE', 'VITE_DEV_BYPASS_AUTH', 'APP_PUBLIC_URL', 'FRONTEND_URL',
    'MONGODB_URI', 'REDIS_URL', 'ENABLE_GITHUB_SYNC_CRON',
    'CLERK_SECRET_KEY', 'VITE_CLERK_PUBLISHABLE_KEY', 'RESEND_API_KEY', 'RESEND_FROM',
    'AI_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL',
    'DASHSCOPE_API_KEY', 'QWEN_ASR_BASE_URL', 'QWEN_ASR_MODEL'
)

function Show-Boundary {
    Write-Host 'PREPARATION ONLY: campus-local rejects production today. Nothing here enables deployment or registration.'
    Write-Host 'Clerk is the existing identity provider; live signup/login is not verified by this tool.'
    Write-Host 'Resend is reserved: email auth returns 503; an SMTP/API key cannot create accounts or sessions.'
    Write-Host 'No services are started/restarted. Server capacity must be resolved before deployment.'
    Write-Host 'Never source this file or use shell evaluation. Load it with the application dotenv parser.'
    Write-Host 'For a frontend build, copy ONLY VITE_* public values; never pass the whole private file to a frontend build.'
}

function Assert-Interactive {
    if ($NonInteractive -or [Console]::IsInputRedirected -or -not [Environment]::UserInteractive) {
        throw 'This action requires an interactive terminal. Use Validate or SelfTest for noninteractive use.'
    }
}

function New-PrivateAcl {
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object Security.AccessControl.FileSecurity
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'Allow')))
    return $acl
}

function Assert-PrivateFile([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Configuration must be a regular file, not a link or directory.'
    }
    if ($item.Length -gt 65536) { throw 'Configuration is too large.' }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $acl = [IO.File]::GetAccessControl($Path)
    if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid) {
        throw 'Configuration must be owned by the current Windows user with inheritance disabled.'
    }
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -ne $sid) {
            throw 'Configuration permissions allow another identity. Restrict its ACL before reading/uploading.'
        }
    }
}

function ConvertTo-Dotenv([System.Collections.IDictionary]$Values) {
    $lines = [Collections.Generic.List[string]]::new()
    $lines.Add('# PREPARATION ONLY. Not deployable today. Never source or eval this file.')
    $lines.Add('# UTF-8 dotenv data; not a systemd EnvironmentFile (quoting semantics differ).')
    foreach ($key in $script:AllowedKeys) {
        if (-not $Values.Contains($key)) { continue }
        $value = [string]$Values[$key]
        if ($value -match '[\x00-\x1f\x7f]') { throw "Control characters are not allowed in $key." }
        # dotenv has no general-purpose quote escaping. Choose a literal delimiter
        # absent from the value; never silently alter credentials with shell escapes.
        $quote = "'"
        if ($value.Contains($quote)) {
            $quote = '"'
            if ($value.Contains($quote) -or $value -match '\\[nr]') { $quote = '`' }
        }
        if ($value.Contains($quote)) { throw "Value for $key cannot be represented losslessly as single-line dotenv." }
        $lines.Add($key + '=' + $quote + $value + $quote)
    }
    return ($lines -join "`n") + "`n"
}

function Read-Configuration([string]$Path) {
    Assert-PrivateFile $Path
    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) {
        throw 'Configuration must be UTF-8 without BOM.'
    }
    $text = $script:Utf8.GetString($bytes)
    $values = [ordered]@{}
    foreach ($line in ($text -split "`n")) {
        $line = $line.TrimEnd("`r")
        if ($line -match '^\s*(#.*)?$') { continue }
        if ($line -notmatch '^([A-Z][A-Z0-9_]*)=([\x27\x22\x60])(.*)\2$') {
            throw 'Invalid configuration syntax; only KEY=quoted-value lines and comments are accepted.'
        }
        $key = $Matches[1]; $quote = $Matches[2]; $value = $Matches[3]
        if ($script:AllowedKeys -cnotcontains $key -or $values.Contains($key)) {
            throw 'Configuration contains an unknown or duplicate key.'
        }
        if ($value.Contains($quote) -or $value -match '[\x00-\x1f\x7f]' -or ($quote -eq '"' -and $value -match '\\[nr]')) {
            throw "Invalid or ambiguous dotenv quoting for $key."
        }
        $values[$key] = $value
    }
    Assert-Configuration $values
    return $values
}

function Assert-Https([string]$Value, [string]$Key, [switch]$Origin) {
    $uri = $null
    if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri) -or
        $uri.Scheme -ne 'https' -or -not $uri.Host -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or
        $Value -match '\s|\\' -or ($Origin -and $uri.AbsolutePath -ne '/')) {
        throw "$Key must be an HTTPS URL without credentials, query or fragment (public URL must be an origin)."
    }
}

function Assert-Configuration([System.Collections.IDictionary]$Values) {
    foreach ($key in $Values.Keys) {
        if ($script:AllowedKeys -cnotcontains $key -or [string]::IsNullOrWhiteSpace([string]$Values[$key])) {
            throw 'Unknown key or empty configuration value.'
        }
    }
    $fixed = [ordered]@{
        NODE_ENV = 'production'; APP_PROFILE = 'campus-local'; HOST = '127.0.0.1'; PORT = '5002'
        DEV_BYPASS_AUTH = 'false'; VITE_APP_PROFILE = 'campus-local'; VITE_DEV_BYPASS_AUTH = 'false'
        ENABLE_GITHUB_SYNC_CRON = 'false'
    }
    foreach ($key in $fixed.Keys) {
        if ($Values[$key] -cne $fixed[$key]) { throw "$key must retain the safe preparation value." }
    }
    foreach ($key in @('APP_PUBLIC_URL', 'FRONTEND_URL', 'MONGODB_URI', 'REDIS_URL')) {
        if (-not $Values.Contains($key)) { throw "Missing required field: $key." }
    }
    Assert-Https $Values['APP_PUBLIC_URL'] 'APP_PUBLIC_URL' -Origin
    if ($Values['FRONTEND_URL'] -cne $Values['APP_PUBLIC_URL']) { throw 'FRONTEND_URL must equal APP_PUBLIC_URL.' }
    if ($Values['MONGODB_URI'] -notmatch '^mongodb(?:\+srv)?://[^\s]+$') { throw 'MONGODB_URI must be a MongoDB URI.' }
    if ($Values['REDIS_URL'] -notmatch '^rediss?://[^\s]+$') { throw 'REDIS_URL must be a Redis URI.' }
    $clerk = $Values.Contains('CLERK_SECRET_KEY') -or $Values.Contains('VITE_CLERK_PUBLISHABLE_KEY')
    $resend = $Values.Contains('RESEND_API_KEY') -or $Values.Contains('RESEND_FROM')
    if ($clerk -eq $resend) { throw 'Choose exactly one preparation: Clerk, or reserved/unavailable Resend.' }
    if ($clerk) {
        if ($Values['CLERK_SECRET_KEY'] -cnotmatch '^sk_live_[A-Za-z0-9_-]+$' -or
            $Values['VITE_CLERK_PUBLISHABLE_KEY'] -cnotmatch '^pk_live_[A-Za-z0-9_=-]+$') {
            throw 'Clerk preparation requires both live secret and live publishable keys. Values are never checked online.'
        }
    } elseif (-not $Values.Contains('RESEND_API_KEY') -or $Values['RESEND_API_KEY'] -cnotmatch '^re_[A-Za-z0-9_-]+$' -or
        -not $Values.Contains('RESEND_FROM') -or $Values['RESEND_FROM'] -notmatch '^[^<>\r\n]+@[^<>\s]+\.[^<>\s]+$') {
        throw 'Reserved Resend preparation requires an API key and plain sender email; SMTP credentials are not supported.'
    }
    foreach ($group in @(
        ,@('AI_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL')
        ,@('DASHSCOPE_API_KEY', 'QWEN_ASR_BASE_URL', 'QWEN_ASR_MODEL')
    )) {
        $present = @($group | Where-Object { $Values.Contains($_) }).Count
        if ($present -ne 0 -and $present -ne $group.Count) { throw 'Optional AI/ASR configuration must contain its complete key/base/model group.' }
    }
    if ($Values.Contains('AI_PROVIDER')) {
        if ($Values['AI_PROVIDER'] -cne 'openai') { throw 'This preparer supports only the existing openai-compatible chat provider.' }
        Assert-Https $Values['OPENAI_BASE_URL'] 'OPENAI_BASE_URL'
    }
    if ($Values.Contains('QWEN_ASR_BASE_URL')) { Assert-Https $Values['QWEN_ASR_BASE_URL'] 'QWEN_ASR_BASE_URL' }
}

function Write-PrivateConfiguration([string]$Path, [System.Collections.IDictionary]$Values, [bool]$Overwrite) {
    Assert-Configuration $Values
    $text = ConvertTo-Dotenv $Values
    $Path = [IO.Path]::GetFullPath($Path)
    if ([IO.File]::Exists($Path)) {
        if (-not $Overwrite) { throw 'Local file exists; use explicit -Replace or the Edit menu action.' }
        Assert-PrivateFile $Path
    }
    $temporary = Join-Path ([IO.Path]::GetDirectoryName($Path)) ('.env.server.' + [Guid]::NewGuid().ToString('N') + '.tmp')
    $stream = $null
    try {
        # Windows FileStream accepts security at creation: secrets are never written
        # into a file that briefly inherits a public repository ACL.
        $stream = [IO.FileStream]::new($temporary, [IO.FileMode]::CreateNew, [Security.AccessControl.FileSystemRights]::Write,
            [IO.FileShare]::None, 4096, [IO.FileOptions]::None, (New-PrivateAcl))
        $bytes = $script:Utf8.GetBytes($text)
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
        $stream.Dispose(); $stream = $null
        if ($Overwrite -and [IO.File]::Exists($Path)) { [IO.File]::Replace($temporary, $Path, [NullString]::Value) }
        else { [IO.File]::Move($temporary, $Path) }
    } finally {
        if ($null -ne $stream) { $stream.Dispose() }
        if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    }
}

function Read-Field([string]$Key, [System.Collections.IDictionary]$Previous, [switch]$Secret, [string]$Default = '') {
    $old = $Default
    if ($Previous.Contains($Key)) { $old = [string]$Previous[$Key] }
    $hint = if ($old) { ' [Enter keeps existing/default]' } else { '' }
    if (-not $Secret) {
        $value = Read-Host ($Key + $hint)
        if ($value -eq '') { return $old }
        return $value
    }
    $secure = Read-Host ($Key + $hint + ' (hidden)') -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
    if ($value -eq '') { return $old }
    return $value
}

function Edit-Configuration([bool]$Overwrite) {
    Assert-Interactive
    $previous = [ordered]@{}
    if (Test-Path -LiteralPath $ConfigPath) {
        if (-not $Overwrite) { throw 'Local file already exists. Choose Edit or explicitly pass -Replace.' }
        $previous = Read-Configuration $ConfigPath
    }
    $values = [ordered]@{
        NODE_ENV = 'production'; APP_PROFILE = 'campus-local'; HOST = '127.0.0.1'; PORT = '5002'
        DEV_BYPASS_AUTH = 'false'; VITE_APP_PROFILE = 'campus-local'; VITE_DEV_BYPASS_AUTH = 'false'
        ENABLE_GITHUB_SYNC_CRON = 'false'
    }
    $values['APP_PUBLIC_URL'] = Read-Field 'APP_PUBLIC_URL' $previous
    $values['FRONTEND_URL'] = $values['APP_PUBLIC_URL']
    Write-Host 'Enter dedicated server database URIs; no MongoDB service was found in the server assessment. Do not reuse another app database.'
    $values['MONGODB_URI'] = Read-Field 'MONGODB_URI' $previous -Secret
    $values['REDIS_URL'] = Read-Field 'REDIS_URL' $previous -Secret
    $mode = Read-Host 'Prepare [1] Clerk live keys or [2] reserved Resend (UNAVAILABLE, cannot register/login)'
    switch ($mode) {
        '1' {
            $values['CLERK_SECRET_KEY'] = Read-Field 'CLERK_SECRET_KEY' $previous -Secret
            $values['VITE_CLERK_PUBLISHABLE_KEY'] = Read-Field 'VITE_CLERK_PUBLISHABLE_KEY' $previous
        }
        '2' {
            $values['RESEND_API_KEY'] = Read-Field 'RESEND_API_KEY' $previous -Secret
            $values['RESEND_FROM'] = Read-Field 'RESEND_FROM' $previous
        }
        default { throw 'Select 1 or 2; no authentication mode was selected.' }
    }
    if ((Read-Host 'Include existing OpenAI-compatible chat configuration? [y/N]') -eq 'y') {
        $values['AI_PROVIDER'] = 'openai'
        $values['OPENAI_API_KEY'] = Read-Field 'OPENAI_API_KEY' $previous -Secret
        $values['OPENAI_BASE_URL'] = Read-Field 'OPENAI_BASE_URL' $previous -Default 'https://api.vibekey.cn/v1'
        $values['OPENAI_MODEL'] = Read-Field 'OPENAI_MODEL' $previous -Default 'gpt-6.1-sol'
    }
    if ((Read-Host 'Include existing Qwen ASR configuration? [y/N]') -eq 'y') {
        $values['DASHSCOPE_API_KEY'] = Read-Field 'DASHSCOPE_API_KEY' $previous -Secret
        $values['QWEN_ASR_BASE_URL'] = Read-Field 'QWEN_ASR_BASE_URL' $previous -Default 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        $values['QWEN_ASR_MODEL'] = Read-Field 'QWEN_ASR_MODEL' $previous -Default 'qwen3-asr-flash'
    }
    Write-PrivateConfiguration $ConfigPath $values $Overwrite
    Write-Host 'Saved private UTF-8 configuration. Contents are not printed. Production is still blocked.'
}

function Invoke-RemoteScript([string]$Script) {
    # Only fixed script text and internally generated hexadecimal tokens cross this
    # shell boundary. Environment contents are transferred by scp, never commands.
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = "$env:SystemRoot\System32\OpenSSH\ssh.exe"
    $info.Arguments = '-T -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=2 evren_test "sh -s"'
    $info.UseShellExecute = $false
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $info
    try {
        $null = $process.Start()
        # Windows PowerShell's native pipeline adds CRLF; sh requires literal LF.
        $bytes = $script:Utf8.GetBytes($Script.Replace("`r`n", "`n") + "`n")
        $process.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
        $process.StandardInput.Close()
        $result = $process.StandardOutput.ReadToEnd()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) { throw 'SSH operation failed; no deployment was performed.' }
        return $result.TrimEnd("`r", "`n")
    } finally { $process.Dispose() }
}

function Upload-Configuration {
    $null = Read-Configuration $ConfigPath
    $ssh = "$env:SystemRoot\System32\OpenSSH\ssh.exe"
    $scp = "$env:SystemRoot\System32\OpenSSH\scp.exe"
    if (-not (Test-Path -LiteralPath $ssh) -or -not (Test-Path -LiteralPath $scp)) { throw 'Windows OpenSSH Client is required.' }
    $token = [Guid]::NewGuid().ToString('N')
    $prepare = @'
set -eu
umask 077
base="$HOME/.config"
dir="$base/career-sprout"
[ ! -L "$base" ] || exit 21
if [ ! -e "$base" ]; then mkdir -m 700 "$base"; fi
[ -d "$base" ] && [ -O "$base" ] || exit 22
[ "$(stat -c %a "$base")" = 700 ] || [ "$(stat -c %a "$base")" = 755 ] || exit 23
[ ! -L "$dir" ] || exit 24
if [ ! -e "$dir" ]; then mkdir -m 700 "$dir"; fi
[ -d "$dir" ] && [ -O "$dir" ] && [ "$(stat -c %a "$dir")" = 700 ] || exit 25
stage="$dir/.upload-TOKEN"
mkdir -m 700 "$stage"
: > "$stage/server.env"
chmod 600 "$stage/server.env"
'@
    $finalize = @'
set -eu
umask 077
dir="$HOME/.config/career-sprout"
stage="$dir/.upload-TOKEN"
[ ! -L "$dir" ] && [ -O "$dir" ] && [ "$(stat -c %a "$dir")" = 700 ] || exit 26
[ -f "$stage/server.env" ] && [ ! -L "$stage/server.env" ] && [ -O "$stage/server.env" ] || exit 27
chmod 600 "$stage/server.env"
target="$dir/server.env"
if [ "REPLACE" = 1 ]; then
  [ ! -L "$target" ] || exit 28
  if [ -e "$target" ]; then [ -f "$target" ] && [ -O "$target" ] || exit 29; fi
  mv -fT "$stage/server.env" "$target"
else
  ln -T "$stage/server.env" "$target"
  rm "$stage/server.env"
fi
rmdir "$stage"
printf 'Private dotenv path: %s\n' "$target"
'@
    try {
        $null = Invoke-RemoteScript ($prepare.Replace('TOKEN', $token))
        & $scp -q -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -- ([IO.Path]::GetFullPath($ConfigPath)) "evren_test:.config/career-sprout/.upload-$token/server.env"
        if ($LASTEXITCODE -ne 0) { throw 'SCP transfer failed.' }
        $replaceFlag = if ($Replace) { '1' } else { '0' }
        $output = Invoke-RemoteScript ($finalize.Replace('TOKEN', $token).Replace('REPLACE', $replaceFlag))
        $output | ForEach-Object { Write-Host $_ }
        Write-Host 'Private configuration uploaded only. Load using application dotenv, never source; no service was changed.'
    } finally {
        $cleanup = 'rm -f -- "$HOME/.config/career-sprout/.upload-TOKEN/server.env"; rmdir -- "$HOME/.config/career-sprout/.upload-TOKEN" 2>/dev/null || :'
        try { $null = Invoke-RemoteScript ($cleanup.Replace('TOKEN', $token)) }
        catch { Write-Warning 'Remote staging cleanup could not be confirmed; inspect the private .upload directory manually.' }
    }
}

function Invoke-SelfTest {
    $directory = Join-Path ([IO.Path]::GetTempPath()) ('Career Sprout & config ' + [Guid]::NewGuid().ToString('N'))
    $null = [IO.Directory]::CreateDirectory($directory)
    $path = Join-Path $directory '.env.server.local'
    $values = [ordered]@{
        NODE_ENV = 'production'; APP_PROFILE = 'campus-local'; HOST = '127.0.0.1'; PORT = '5002'
        DEV_BYPASS_AUTH = 'false'; VITE_APP_PROFILE = 'campus-local'; VITE_DEV_BYPASS_AUTH = 'false'
        ENABLE_GITHUB_SYNC_CRON = 'false'; APP_PUBLIC_URL = 'https://example.invalid'; FRONTEND_URL = 'https://example.invalid'
        MONGODB_URI = 'mongodb://127.0.0.1:27018/dummy'; REDIS_URL = 'redis://127.0.0.1:6380'
        CLERK_SECRET_KEY = 'sk_live_dummy'; VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_dummy'
        AI_PROVIDER = 'openai'; OPENAI_API_KEY = 'dummy $() & | ; < > "quoted" \n % ! # ='
        OPENAI_BASE_URL = 'https://example.invalid/v1'; OPENAI_MODEL = 'dummy'
    }
    try {
        Write-PrivateConfiguration $path $values $false
        $loaded = Read-Configuration $path
        if ($loaded['OPENAI_API_KEY'] -cne $values['OPENAI_API_KEY']) { throw 'Literal-value round trip failed.' }
        foreach ($literal in @("dummy'quoted", 'dummy''and"quotes', 'dummy`backtick')) {
            $values['OPENAI_API_KEY'] = $literal
            Write-PrivateConfiguration $path $values $true
            if ((Read-Configuration $path)['OPENAI_API_KEY'] -cne $literal) { throw 'Quote round trip failed.' }
        }
        $rejected = $false
        try { Write-PrivateConfiguration $path $values $false } catch { $rejected = $true }
        if (-not $rejected) { throw 'No-overwrite check failed.' }
        foreach ($origin in @('http://example.invalid', 'https://user:pass@example.invalid', 'https://example.invalid/path', 'https://example.invalid/?x=1', 'https://example.invalid/#fragment')) {
            $values['APP_PUBLIC_URL'] = $origin; $values['FRONTEND_URL'] = $origin
            $rejected = $false
            try { Assert-Configuration $values } catch { $rejected = $true }
            if (-not $rejected) { throw 'Invalid origin was accepted.' }
        }
        $values['APP_PUBLIC_URL'] = 'https://example.invalid'; $values['FRONTEND_URL'] = 'https://example.invalid'
        $values['DEV_BYPASS_AUTH'] = 'true'
        $rejected = $false
        try { Assert-Configuration $values } catch { $rejected = $true }
        if (-not $rejected) { throw 'Production bypass was accepted.' }
        $values['DEV_BYPASS_AUTH'] = 'false'
        $valid = ConvertTo-Dotenv $values
        foreach ($suffix in @('EVIL="$(touch should-not-exist)"', 'NODE_ENV=''production''', 'OPENAI_API_KEY=$(touch should-not-exist)', 'Write-Output hacked')) {
            [IO.File]::WriteAllText($path, $valid + $suffix + "`n", $script:Utf8)
            $rejected = $false
            try { $null = Read-Configuration $path } catch { $rejected = $true }
            if (-not $rejected) { throw 'Malicious or duplicate configuration was accepted.' }
        }
        $values.Remove('OPENAI_MODEL')
        $rejected = $false
        try { Assert-Configuration $values } catch { $rejected = $true }
        if (-not $rejected) { throw 'Incomplete provider group was accepted.' }
        $values['OPENAI_MODEL'] = 'dummy'
        $values.Remove('CLERK_SECRET_KEY'); $values.Remove('VITE_CLERK_PUBLISHABLE_KEY')
        $values['RESEND_API_KEY'] = 're_dummy'; $values['RESEND_FROM'] = 'dummy@example.invalid'
        Assert-Configuration $values
        Write-PrivateConfiguration $path $values $true
        $launcher = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'configure-server.bat'
        $info = New-Object Diagnostics.ProcessStartInfo
        $info.FileName = "$env:SystemRoot\System32\cmd.exe"
        $info.Arguments = '/d /s /c ""' + $launcher + '" -Action Validate -NonInteractive -ConfigPath "' + $path + '""'
        $info.WorkingDirectory = $directory
        $info.UseShellExecute = $false
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        foreach ($expected in @(0, 1)) {
            if ($expected -eq 1) { [IO.File]::AppendAllText($path, 'EVIL="$(never execute)"', $script:Utf8) }
            $process = New-Object Diagnostics.Process
            $process.StartInfo = $info
            try {
                $null = $process.Start()
                $stdout = $process.StandardOutput.ReadToEnd()
                $stderr = $process.StandardError.ReadToEnd()
                $process.WaitForExit()
                if ($process.ExitCode -ne $expected -or $stdout.Contains('re_dummy') -or $stderr.Contains('re_dummy')) {
                    throw 'Batch validation exit status or secret-redaction check failed.'
                }
            } finally { $process.Dispose() }
        }
        Write-Host 'SELFTEST PASS: ACL/no BOM, literal quotes/metacharacters, no-overwrite/replacement, invalid origins, bypass/malicious syntax, complete provider groups, reserved Resend, actual BAT Validate success/failure from a spaced/metacharacter directory. No network calls.'
    } finally {
        if ([IO.Directory]::Exists($directory)) { [IO.Directory]::Delete($directory, $true) }
    }
}

$exitCode = 0
$interactiveMenu = $Action -eq 'Menu' -and -not $NonInteractive -and -not [Console]::IsInputRedirected -and [Environment]::UserInteractive
try {
    if ($env:OS -ne 'Windows_NT') { throw 'Run this helper with Windows PowerShell through configure-server.bat.' }
    Show-Boundary
    switch ($Action) {
        'Create' { Edit-Configuration ([bool]$Replace) }
        'Validate' { $null = Read-Configuration $ConfigPath; Write-Host 'VALID: preparation file only; no credentials were verified online.' }
        'Upload' { Upload-Configuration }
        'SelfTest' { Invoke-SelfTest }
        'Menu' {
            Assert-Interactive
            Write-Host '1 Create | 2 Edit existing | 3 Validate | 4 Upload (no overwrite) | 5 Upload (explicit replace) | Q Quit'
            switch (Read-Host 'Choose') {
                '1' { Edit-Configuration $false }
                '2' { Edit-Configuration $true }
                '3' { $null = Read-Configuration $ConfigPath; Write-Host 'VALID: preparation only.' }
                '4' { Upload-Configuration }
                '5' {
                    if ((Read-Host 'Type REPLACE to replace the remote private file') -cne 'REPLACE') { throw 'Replacement cancelled.' }
                    $Replace = $true; Upload-Configuration
                }
                'q' { }
                default { throw 'Unknown menu selection.' }
            }
        }
    }
} catch {
    # Never emit ErrorRecord/stack/command arguments: they can include submitted data.
    Write-Host ('FAILED: ' + $_.Exception.Message)
    $exitCode = 1
} finally {
    if ($interactiveMenu) { $null = Read-Host 'Press Enter to close' }
}
exit $exitCode
