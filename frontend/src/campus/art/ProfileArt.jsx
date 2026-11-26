const motifs = {
  personal: <><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 3.5v17M3.5 8h3m-3 4h3m-3 4h3m5.5-8h4m-4 4h4" /></>,
  experiences: <><path d="M4 18h5a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h6m2 7V3l5 2.5L16 8" /><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" /></>,
  skills: <><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h7m4 0h7m-11-1h4v3h-4z" /></>,
  materials: <path d="M7 13V3.5h7l3 3V13m-3-9.5v3h3M9.5 9.5h5M5.5 11 3 15v4a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 19v-4l-2.5-4M3 15h6l1 2h4l1-2h6" />,
}

export function ProfileMotif({ view }) {
  return (
    <svg className="profile-nav-motif" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {motifs[view]}
    </svg>
  )
}

function Notebook() {
  return <>
    <path d="M22 69C17 55 31 30 48 23c19-8 34-1 54-2 26-2 43 11 39 30-4 24-31 34-61 37-31 3-53-2-58-19Z" fill="currentColor" fillOpacity=".07" stroke="none" />
    <path d="M18 68l6-1m-3 11 6-2m93-51 5-2m0 7 5-2" opacity=".35" />
    <g transform="rotate(-8 73 50)">
      <rect x="40" y="19" width="63" height="67" rx="6" fill="currentColor" fillOpacity=".18" stroke="none" />
      <rect x="37" y="15" width="63" height="67" rx="6" fill="var(--card)" />
      <path d="M50 15v67" opacity=".7" />
      <path d="M34 29h9m-9 14h9m-9 14h9m-9 14h9" strokeWidth="2.5" />
      <rect x="58" y="26" width="32" height="30" rx="3" fill="currentColor" fillOpacity=".08" stroke="none" />
      <path d="M72 51c0-8 3-13 8-17m-7 10c-6 0-9-3-10-7 6 0 10 2 10 7Zm3-5c0-6 4-9 9-9-1 5-4 8-9 9Z" />
      <path d="M59 64h29m-29 6h20" opacity=".48" />
      <path d="M95 81v10l-4-3-4 3V81" fill="var(--warn)" fillOpacity=".22" stroke="var(--warn)" />
    </g>
    <path d="m112 74 16-34a3.7 3.7 0 0 1 6.7 3.1l-16 34-9 7Z" fill="var(--card)" stroke="var(--warn)" />
    <path d="m112 74 6.7 3.1m7.5-33.4 6.7 3.1m-22 33.8 3.1 1.5" stroke="var(--warn)" />
  </>
}

function MilestoneTrail() {
  return <>
    <path d="M16 65c3-14 22-16 34-27 17-16 25-23 46-20 23 3 45 12 48 31 4 24-20 36-53 38-28 2-81 8-75-22Z" fill="currentColor" fillOpacity=".08" stroke="none" />
    <g opacity=".28">
      <path d="M22 61c9-7 25-8 34-17s13-17 28-17c7 0 13 3 18 5M24 67c11-8 24-5 36-16s13-16 25-16c4 0 7 1 10 2M80 80c10-13 15-15 27-15s21-2 29-11m-44 27c6-7 11-9 19-9s15-2 21-7" />
      <path d="m39 48 1-6m0 2 4-3M131 46l2-7m-1 4 5-2m-5 3-3-4" />
    </g>
    <path d="M32 77C46 71 55 82 67 73c16-12 5-20 24-26 16-5 29-2 30-20" strokeWidth="2.5" strokeDasharray=".1 5.4" />
    <circle cx="32" cy="77" r="4.5" fill="var(--card)" />
    <circle cx="67" cy="73" r="5" fill="var(--card)" />
    <circle cx="91" cy="47" r="5" fill="var(--card)" />
    <circle cx="91" cy="47" r="1.5" fill="currentColor" stroke="none" />
    <path d="M121 30V12c8-4 12 5 19 0l-4 9c-6 2-8-5-15-2" fill="var(--warn)" fillOpacity=".19" stroke="var(--warn)" />
  </>
}

function Toolkit() {
  return <>
    <path d="M20 64c6-11 9-26 25-32 14-6 26 1 42-3 24-7 49-2 54 13 8 23-18 44-51 45-31 1-81-3-70-23Z" fill="currentColor" fillOpacity=".08" stroke="none" />
    <path d="M22 78c20 6 98 11 120-6" opacity=".22" />
    <path d="M35 55l7-13h74l9 13Z" fill="var(--paper)" />
    <g transform="rotate(-25 54 41)" stroke="var(--warn)">
      <rect x="47" y="17" width="14" height="46" rx="1.5" fill="var(--card)" />
      <path d="M47 23h6m-6 6h4m-4 6h6m-6 6h4m-4 6h6m-6 6h4" />
    </g>
    <path d="M77 58V35c-7-4-9-11-4-17l4 8 6-1 3-8c7 4 6 14-1 18v23Z" fill="var(--accent-ink)" />
    <path d="m96 57 9-32 6-6 2 8-9 32m1-34 8 2" fill="var(--card)" stroke="var(--warn)" />
    <rect x="34" y="51" width="92" height="30" rx="6" fill="var(--card)" />
    <path d="M34 61h92v14a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6Z" fill="currentColor" fillOpacity=".17" stroke="none" />
    <path d="M34 61h92m-83 11h18m38 0h18" opacity=".55" />
    <rect x="71" y="57" width="18" height="10" rx="2" fill="var(--accent-ink)" />
    <path d="M76 62h8" />
  </>
}

function DocumentTray() {
  return <>
    <path d="M18 61c0-17 17-30 40-31 19-1 29-10 49-5 22 5 40 21 35 37-4 19-27 26-62 26-34 0-62-8-62-27Z" fill="currentColor" fillOpacity=".08" stroke="none" />
    <path d="M25 82c22 6 90 10 111-5" opacity=".22" />
    <path d="m33 63 12-19h67l14 19-20 9H52Z" fill="currentColor" fillOpacity=".16" />
    <rect x="68" y="18" width="39" height="47" rx="3" transform="rotate(11 88 42)" fill="var(--paper)" />
    <g transform="rotate(-8 73 42)">
      <path d="M53 18a3 3 0 0 1 3-3h25l12 12v37H53Z" fill="var(--card)" />
      <path d="M81 15v12h12m-31 7h22m-22 7h18m-18 7h21" />
    </g>
    <path d="M33 63h29l5 7h24l5-7h30v13a6 6 0 0 1-6 6H39a6 6 0 0 1-6-6Z" fill="var(--card)" />
    <path d="M33 67h27l5 7h28l5-7h28v9a6 6 0 0 1-6 6H39a6 6 0 0 1-6-6Z" fill="currentColor" fillOpacity=".13" stroke="none" />
    <path d="M120 29v16m-5-5 5 5 5-5" stroke="var(--warn)" strokeWidth="2" />
    <path d="M23 51h7m-3.5-3.5v7m103 2h6" opacity=".42" />
  </>
}

const scenes = { personal: Notebook, experiences: MilestoneTrail, skills: Toolkit, materials: DocumentTray }

export function ProfileIllustration({ view }) {
  const Scene = scenes[view]
  return (
    <svg className="profile-illustration" viewBox="0 0 160 102" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <Scene />
      <g className="profile-entry-dots" fill="currentColor" stroke="none">
        <circle cx="25" cy="36" r="2" />
        <circle cx="111" cy="17" r="2.6" />
        <circle cx="139" cy="57" r="1.8" />
      </g>
    </svg>
  )
}
