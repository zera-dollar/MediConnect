import {
  Activity,
  Ambulance,
  ArrowRight,
  Bed,
  Bell,
  BriefcaseMedical,
  CalendarDays,
  Droplets,
  HeartPulse,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Wind,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const patientCapabilities = [
  { icon: MapPin, title: 'Find nearby hospitals', description: 'Explore active facilities and estimate distance when you share your location.' },
  { icon: Bed, title: 'Check reported resources', description: 'Compare hospital-reported beds, blood, oxygen, and equipment availability.' },
  { icon: CalendarDays, title: 'Request an appointment', description: 'Choose an available professional and submit a preferred date and duration.' },
  { icon: Ambulance, title: 'Request transport', description: 'Send a transport request to a hospital dispatch team and follow its status.' },
]

const operationsCapabilities = [
  { icon: BriefcaseMedical, title: 'Coordinate healthcare teams', description: 'Hospitals manage staffing opportunities, bids, assignments, and team access.' },
  { icon: Activity, title: 'Monitor facility resources', description: 'Authorized teams review and update beds, blood, oxygen, and other inventory.' },
  { icon: Bell, title: 'Keep teams informed', description: 'In-app notifications surface resource alerts and workflow updates.' },
  { icon: ShieldCheck, title: 'Track operational activity', description: 'Role-based access and read-only activity history support accountable workflows.' },
]

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#f7faf9] text-ink">
      <header className="relative z-10 border-b border-[#e2ebe6] bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="MediConnect home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-white">
              <HeartPulse size={21} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-bold tracking-tight">MediConnect</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Care coordination</span>
            </span>
          </a>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
            <a href="#capabilities" className="transition hover:text-forest">Capabilities</a>
            <a href="#why-mediconnect" className="transition hover:text-forest">Why MediConnect</a>
            <a href="#how-it-works" className="transition hover:text-forest">How it works</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/connect" className="rounded-lg px-3 py-2 text-sm font-semibold text-forest transition hover:bg-[#eff6f2]">Sign in</Link>
            <Link to="/register" className="rounded-lg bg-forest px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#164333] sm:px-4">Get started</Link>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative isolate">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_82%_15%,rgba(83,166,135,0.16),transparent_35%),linear-gradient(180deg,#ffffff_0%,#f2f8f5_100%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#d7e8df] bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-forest">
                <span className="h-2 w-2 rounded-full bg-[#4e9b73]" /> One connected care workspace
              </p>
              <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-[#183348] sm:text-5xl lg:text-[60px]">
                Make the next care decision with <span className="text-forest">clearer information.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#596e7c] sm:text-lg sm:leading-8">
                MediConnect brings hospital-reported resource availability, nearby facility discovery, appointment requests, and care-team operations into one role-based platform.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register" className="inline-flex items-center gap-2 rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-forest/15 transition hover:-translate-y-0.5 hover:bg-[#164333]">
                  Create an account <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <a href="#capabilities" className="rounded-lg border border-[#d5e1da] bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-forest hover:text-forest">
                  Explore the platform
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-forest" aria-hidden="true" /> Role-based access</span>
                <span className="inline-flex items-center gap-1.5"><Stethoscope size={14} className="text-forest" aria-hidden="true" /> Built for care teams and patients</span>
              </div>
            </div>

            <div aria-label="MediConnect resource overview illustration" className="relative mx-auto w-full max-w-[520px]">
              <div className="absolute -left-7 top-12 h-32 w-32 rounded-full bg-[#d9efe4] blur-2xl" aria-hidden="true" />
              <div className="absolute -right-4 bottom-3 h-40 w-40 rounded-full bg-[#d8eaf0] blur-2xl" aria-hidden="true" />
              <div className="relative rounded-[26px] border border-white bg-white p-5 shadow-[0_26px_80px_rgba(27,65,58,0.13)] sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-forest">Care at a glance</p>
                    <h2 className="mt-1 text-xl font-semibold text-ink">Connected services</h2>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4ed] text-forest">
                    <Activity size={20} aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-4 rounded-xl border border-[#e8efeb] p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#edf6f1] text-forest"><Bed size={19} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Hospital resources</p>
                      <p className="mt-0.5 text-xs text-muted">Beds · blood · oxygen · equipment</p>
                    </div>
                    <span className="text-xs font-medium text-muted">Reported</span>
                  </div>
                  <div className="flex items-center gap-4 rounded-xl border border-[#e8efeb] p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef4f7] text-[#3d6c80]"><MapPin size={19} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Hospital discovery</p>
                      <p className="mt-0.5 text-xs text-muted">Locations and distance estimates</p>
                    </div>
                    <span className="text-xs font-medium text-muted">Nearby</span>
                  </div>
                  <div className="flex items-center gap-4 rounded-xl border border-[#e8efeb] p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5f0e5] text-[#96732d]"><CalendarDays size={19} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Appointments and transport</p>
                      <p className="mt-0.5 text-xs text-muted">Requests with status updates</p>
                    </div>
                    <span className="text-xs font-medium text-muted">Coordinated</span>
                  </div>
                </div>
                <p className="mt-5 border-t border-[#edf1ee] pt-4 text-xs leading-5 text-muted">
                  An overview of platform capabilities—not live hospital availability.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="why-mediconnect" className="scroll-mt-20 border-y border-[#e4ece7] bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:py-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest">Why it matters</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">Make fragmented care information easier to act on.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-2xl bg-[#f4f8f6] p-5">
                <Wind size={20} className="text-forest" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">See what facilities report</h3>
                <p className="mt-2 text-sm leading-6 text-muted">Review resource snapshots by hospital to help guide a search for care. Availability depends on each facility’s latest updates.</p>
              </article>
              <article className="rounded-2xl bg-[#f4f8f6] p-5">
                <MapPin size={20} className="text-forest" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">Find a starting point</h3>
                <p className="mt-2 text-sm leading-6 text-muted">Discover active hospital listings and optionally use your location for approximate distance estimates.</p>
              </article>
              <article className="rounded-2xl bg-[#f4f8f6] p-5">
                <CalendarDays size={20} className="text-forest" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">Make a care request</h3>
                <p className="mt-2 text-sm leading-6 text-muted">Submit appointment requests with a professional or send an ambulance request to a hospital’s in-app dispatch team.</p>
              </article>
              <article className="rounded-2xl bg-[#f4f8f6] p-5">
                <Droplets size={20} className="text-forest" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">Support coordinated operations</h3>
                <p className="mt-2 text-sm leading-6 text-muted">Give authorized hospital teams tools for staffing workflows, resource updates, alerts, and activity history.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="capabilities" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest">Platform capabilities</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Useful tools for each part of the care journey.</h2>
              <p className="mt-3 text-sm leading-6 text-muted">The dashboard adapts to your role. Patients focus on care discovery and requests; healthcare and hospital teams see operational tools relevant to their access.</p>
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              <section className="rounded-2xl border border-[#dfeae3] bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f4ed] text-forest"><HeartPulse size={21} aria-hidden="true" /></span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-forest">For patients</p>
                    <h3 className="text-lg font-semibold">Navigate care in one place</h3>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {patientCapabilities.map(({ icon: Icon, title, description }) => (
                    <article key={title} className="flex gap-3">
                      <Icon size={17} className="mt-0.5 shrink-0 text-forest" aria-hidden="true" />
                      <div><h4 className="text-sm font-semibold">{title}</h4><p className="mt-1 text-xs leading-5 text-muted">{description}</p></div>
                    </article>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-[#dfeae3] bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef4f7] text-[#3d6c80]"><BriefcaseMedical size={21} aria-hidden="true" /></span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#3d6c80]">For healthcare teams</p>
                    <h3 className="text-lg font-semibold">Coordinate hospital operations</h3>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {operationsCapabilities.map(({ icon: Icon, title, description }) => (
                    <article key={title} className="flex gap-3">
                      <Icon size={17} className="mt-0.5 shrink-0 text-[#3d6c80]" aria-hidden="true" />
                      <div><h4 className="text-sm font-semibold">{title}</h4><p className="mt-1 text-xs leading-5 text-muted">{description}</p></div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 bg-[#173b3d] text-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a6d8bd]">How it works</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From information to next steps.</h2>
            </div>
            <ol className="mt-9 grid gap-4 md:grid-cols-3">
              {[
                ['01', 'Choose your role', 'Create an account and sign in to a workspace tailored to your role.'],
                ['02', 'Explore current information', 'Review the hospital listings and resources reported by connected facilities.'],
                ['03', 'Send a request', 'Book an appointment or submit an in-app ambulance request to a hospital team.'],
              ].map(([number, title, description]) => (
                <li key={number} className="rounded-xl border border-white/15 bg-white/[0.06] p-5">
                  <span className="text-sm font-bold text-[#a6d8bd]">{number}</span>
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">{description}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#0f2e30] p-5 sm:px-6">
              <p className="max-w-2xl text-sm leading-6 text-white/80">
                In an emergency, contact your local emergency services directly. MediConnect ambulance requests are routed to an in-app hospital dispatch team and are not connected to an external ambulance provider.
              </p>
              <Link to="/register" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#173b3d] transition hover:bg-[#eaf4ee]">
                Get started <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e2ebe6] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© MediConnect · Healthcare coordination platform</p>
          <p>Resource information reflects facility-reported updates and is not a substitute for clinical advice.</p>
        </div>
      </footer>
    </div>
  )
}
