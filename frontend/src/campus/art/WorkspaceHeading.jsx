import './WorkspaceHeading.css'

function CompassTrail() {
  return (
    <>
      <path d="M11 66c0-14 17-19 29-30 13-12 22-23 39-21 18 2 24 9 44 10 18 1 30 11 28 26-3 23-31 36-67 36-38 0-73 1-73-21Z" fill="currentColor" fillOpacity=".08" stroke="none" />
      <path d="M18 55c7-7 18-8 27-15 12-9 12-17 28-18m-51 36c8-5 17-6 27-13 12-9 11-15 24-17m40 53c17-4 28-10 34-20m-28 24c13-3 24-10 30-17" opacity=".25" />
      <path d="M24 72c16 7 35 7 39-4 4-10-12-10-11-19 1-8 18-10 30-5" strokeDasharray="2 4" />
      <circle cx="24" cy="72" r="4" fill="var(--card)" />
      <circle cx="59" cy="74" r="2" fill="currentColor" stroke="none" />
      <circle cx="106" cy="53" r="28" fill="currentColor" fillOpacity=".12" stroke="none" />
      <circle cx="103" cy="49" r="28" fill="var(--card)" />
      <circle cx="103" cy="49" r="23" opacity=".45" />
      <path d="M103 29v4m0 32v4M83 49h4m32 0h4m-34-14 2 2m24 24 2 2m0-28-2 2M91 61l-2 2" opacity=".6" />
      <path d="m93 62 6-16 8 6Z" fill="currentColor" fillOpacity=".17" />
      <path d="m99 46 14-10-6 16Z" fill="currentColor" />
      <circle cx="103" cy="49" r="2" fill="var(--card)" stroke="none" />
      <path className="campus-workspace-heading-accent" d="m128 22 4-4m2 10 6-2m-19-8 1-6" stroke="var(--warn)" />
    </>
  )
}

function StitchedResume() {
  return (
    <>
      <path d="M13 65c0-16 16-26 34-33 15-6 15-13 33-15 22-3 35 15 52 22 13 5 20 13 16 25-6 17-38 26-71 26-29 0-64-6-64-25Z" fill="currentColor" fillOpacity=".08" stroke="none" />
      <path d="M23 75c8 4 18 7 30 8m69-46 14 5m-12 0 9 3" opacity=".24" />
      <rect x="78" y="24" width="42" height="61" rx="4" transform="rotate(12 99 55)" fill="var(--paper)" />
      <path d="M115 61l9 2m-10 3 9 2m-10 3 9 2" opacity=".36" />
      <g transform="rotate(-7 73 50)">
        <path d="M41 17a4 4 0 0 1 4-4h43l15 14v53a4 4 0 0 1-4 4H45a4 4 0 0 1-4-4Z" fill="var(--card)" />
        <path d="M88 13v10a4 4 0 0 0 4 4h11m-49-9v61" opacity=".5" />
        <path d="M44 25c7 0 7 6 0 6m0 6c7 0 7 6 0 6m0 6c7 0 7 6 0 6m0 6c7 0 7 6 0 6m0 6c7 0 7 6 0 6" stroke="var(--warn)" />
        <path d="M37 26c5-3 12-2 11 2m-11 10c5-3 12-2 11 2m-11 10c5-3 12-2 11 2m-11 10c5-3 12-2 11 2m-11 10c5-3 12-2 11 2" stroke="var(--warn)" />
        <rect x="62" y="26" width="11" height="11" rx="2" fill="currentColor" fillOpacity=".14" stroke="none" />
        <path d="M78 31h7m-7 5h15M62 46h30m-30 6h22m-22 9h30m-30 6h18" opacity=".56" />
        <path d="m85 74 2 2 5-6" strokeWidth="2" />
      </g>
      <path className="campus-workspace-heading-accent" d="m114 16 3-5m3 9 6-2" stroke="var(--warn)" />
    </>
  )
}

function InterviewMicrophone() {
  return (
    <>
      <path d="M12 58c1-14 18-27 36-28 14-2 23 1 37-4 23-9 40-7 55 8 12 12 10 34-7 44-16 9-40 12-64 11-27-1-59-9-57-31Z" fill="currentColor" fillOpacity=".08" stroke="none" />
      <path d="M21 53h7l4-5 5 12 5-17 4 10h9m53 0h8l4-7 5 14 4-10 4 3h8" opacity=".48" />
      <path d="M43 85c23 4 55 5 79-1" opacity=".24" />
      <path d="M65 47v7a17 17 0 0 0 34 0v-7" strokeWidth="2" />
      <path d="M82 71v11m-15 0h30" strokeWidth="2" />
      <rect x="70" y="19" width="24" height="45" rx="12" fill="var(--card)" />
      <path d="M70 48h24v4a12 12 0 0 1-24 0Z" fill="currentColor" fillOpacity=".16" />
      <path d="M77 30h10m-12 5h14m-14 5h14" opacity=".66" />
      <circle cx="82" cy="55" r="2" fill="var(--warn)" stroke="none" />
      <path className="campus-workspace-heading-accent" d="M101 27c2 2 3 4 3 7m2-12c4 3 6 8 6 12" stroke="var(--warn)" />
    </>
  )
}

const illustrations = { jobs: CompassTrail, resume: StitchedResume, interview: InterviewMicrophone }

export default function WorkspaceHeading({ kind, title, description }) {
  const Illustration = illustrations[kind]
  return (
    <header className="campus-workspace-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <svg className="campus-workspace-heading-art" viewBox="0 0 160 100" width="160" height="100" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <Illustration />
      </svg>
    </header>
  )
}
