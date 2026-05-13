import { useEffect, useMemo, useState } from "react";
import {
  Users,
  TrendingUp,
  Building2,
  DollarSign,
  Target,
  BarChart3,
  CheckCircle2,
  XCircle,
  Globe,
  Shield,
  Search,
  FileCheck,
  MessageSquare,
  ArrowRight,
  Flag,
  Zap,
  Star,
  AlertTriangle,
  Lightbulb,
  TrendingDown,
} from "lucide-react";
import logoImg from "../imports/Logo_gro_.png";
import doctorBg from "../imports/backgrounds/doctor_stethoscope.jpg";
import hospitalBg from "../imports/backgrounds/hospital_corridor.jpg";
import websiteScreenshot from "../imports/website_screenshot.png";
import teamCeoImg from "../imports/team/ceo.png";
import teamCtoImg from "../imports/team/cto.png";
import teamDirectorSalesImg from "../imports/team/director_sales.webp";
import teamDirectorOpsImg from "../imports/team/director_operations.png";
import teamDirectorMarketingImg from "../imports/team/director_marketing.png";

const slides = [
  { id: 0, title: "Cover" },
  { id: 1, title: "Problem" },
  { id: 2, title: "Our Solution" },
  { id: 3, title: "Who Uses findmydoc?" },
  { id: 4, title: "How It Works" },
  { id: 5, title: "Clinic Impact" },
  { id: 6, title: "So, what is findmydoc?" },
  { id: 7, title: "Competitor Analysis" },
  { id: 8, title: "Strategic Position" },
  { id: 9, title: "Market Opportunity" },
  { id: 10, title: "Business Model" },
  { id: 11, title: "3-Year Outlook" },
  { id: 12, title: "Team" },
  { id: 13, title: "Summary" },
  { id: 14, title: "Vision" },
];

export default function App() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const isPrintMode = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).has("print");
    } catch {
      return false;
    }
  }, []);
  const isFrameMode = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).has("frame");
    } catch {
      return false;
    }
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  };

  useEffect(() => {
    if (isPrintMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") nextSlide();
      if (event.key === "ArrowLeft") prevSlide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPrintMode]);

  const slideRenderers = useMemo(
    () => [
      () => <CoverSlide />,
      () => <ProblemSlide />,
      () => <SolutionSlide />,
      () => <WhoUsesSlide />,
      () => <HowItWorksSlide />,
      () => <ClinicImpactSlide />,
      () => <WhatIsSlide />,
      () => <CompetitorAnalysisSlide />,
      () => <SWOTSlide />,
      () => <MarketSlide />,
      () => <BusinessModelSlide />,
      () => <OutlookSlide />,
      () => <TeamSlide />,
      () => <SummarySlide />,
      () => <VisionSlide />,
    ],
    [],
  );

  return (
    <div
      className={
        isPrintMode
          ? "min-h-screen w-screen bg-transparent overflow-visible"
          : "h-screen w-screen bg-transparent overflow-hidden"
      }
    >
      {isPrintMode ? (
        <div className="p-0">
          {slideRenderers.map((render, index) => (
            <PrintPage key={index}>{render()}</PrintPage>
          ))}
        </div>
      ) : isFrameMode ? (
        <FrameStage>{slideRenderers[currentSlide]?.()}</FrameStage>
      ) : (
        <SlideStage>
          {slideRenderers[currentSlide]?.()}
        </SlideStage>
      )}
    </div>
  );
}

function SlideStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <div className="w-[90vw] max-w-[1920px] aspect-video">
        <div className="h-full w-full overflow-hidden p-12 box-border">
          {children}
        </div>
      </div>
    </div>
  );
}

function FrameStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-4 bg-black">
      <div
        className="max-w-[1920px]"
        style={{
          width: "min(98vw, calc(98vh * 16 / 9))",
          aspectRatio: "16 / 9",
        }}
      >
        <div
          className="h-full w-full box-border overflow-hidden"
          style={{
            border: "12px solid #000000",
            borderRadius: 0,
            background: "rgba(255,255,255,0.92)",
          }}
        >
          <div className="h-full w-full p-12 box-border">{children}</div>
        </div>
      </div>
    </div>
  );
}

function PrintPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="print-page">
      <div className="print-slide">{children}</div>
    </div>
  );
}

function SlideLayout({
  title,
  children,
  backgroundSrc,
  tintColor,
}: {
  title?: string;
  children: React.ReactNode;
  backgroundSrc?: string;
  tintColor?: string;
}) {
  return (
    <div className="h-full flex flex-col relative">
      {backgroundSrc ? (
        <div className="fixed inset-0 pointer-events-none z-0">
          <img
            src={backgroundSrc}
            alt=""
            className="h-full w-full object-cover"
            style={{
              opacity: 0.24,
              filter: "blur(1px) saturate(0.85)",
              transform: "scale(1.03)",
            }}
          />
          <div className="absolute inset-0 bg-white/45" />
          {tintColor ? (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${tintColor}22 0%, transparent 55%, ${tintColor}18 100%)`,
                mixBlendMode: "multiply",
              }}
            />
          ) : null}
        </div>
      ) : null}

      <div className="h-[120px] flex items-center justify-center relative z-10">
        {title ? (
          <h2 className="text-6xl text-[#07004C] text-center">
            {title}
          </h2>
        ) : null}
      </div>
      <div className="flex-1 min-h-0 relative z-10">
        {children}
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
}) {
  return (
    <div className="bg-white/85 rounded-3xl p-7 border border-gray-200 shadow-lg flex flex-col items-center justify-center text-center h-full">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ backgroundColor: `${color}1A` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="text-2xl text-[#07004C] font-medium">
        {title}
      </div>
    </div>
  );
}

function SideTag({
  align,
  title,
  subtitle,
  color,
  icon,
}: {
  align: "left" | "right";
  title: string;
  subtitle: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`w-full max-w-md rounded-3xl border-2 p-8 shadow-lg bg-white/85 ${
        align === "right" ? "text-right" : "text-left"
      }`}
      style={{ borderColor: color }}
    >
      <div
        className={`flex items-center gap-3 mb-3 ${
          align === "right" ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          {icon}
        </div>
        <div className="text-2xl text-[#07004C] font-medium">
          {title}
        </div>
      </div>
      <div className="text-lg text-gray-700">{subtitle}</div>
    </div>
  );
}

function MiniPill({ label }: { label: string }) {
  return (
    <div className="px-4 py-2 rounded-full bg-white/85 border border-gray-200 text-gray-700 text-lg">
      {label}
    </div>
  );
}

function LaptopMock({ screenshotSrc }: { screenshotSrc?: string }) {
  return (
    <div className="relative">
      <div className="w-[clamp(520px,34vw,720px)] max-h-[58vh] aspect-[16/10] rounded-[22px] bg-white/90 border-2 border-gray-200 shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="h-12 flex items-center justify-between px-5 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-400/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
            <div className="h-3 w-3 rounded-full bg-green-400/80" />
          </div>
          <div className="h-6 w-56 rounded-lg bg-white border border-gray-200" />
          <div className="w-16" />
        </div>

        {/* Screen */}
        <div className="p-8 h-full">
          {screenshotSrc ? (
            <img
              src={screenshotSrc}
              alt="Website screenshot"
              className="w-full h-full object-contain rounded-2xl border border-gray-200 bg-white"
            />
          ) : (
            <div className="w-full h-full rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="h-14 flex items-center justify-between px-6 border-b border-gray-100">
                <img src={logoImg} alt="findmydoc" className="h-8" />
                <div className="flex items-center gap-3">
                  <div className="h-8 w-20 rounded-xl bg-gray-100" />
                  <div className="h-8 w-28 rounded-xl bg-[#0076FF]/15 border border-[#0076FF]/25" />
                </div>
              </div>
              <div className="p-8 grid grid-cols-2 gap-6 h-[calc(100%-56px)]">
                <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-[#0076FF]/10 to-[#42E2B7]/10 p-6">
                  <div className="text-2xl text-[#07004C] font-medium mb-3">
                    Compare verified clinics
                  </div>
                  <div className="text-gray-600">
                    Transparent profiles, itemized offers, secure communication.
                  </div>
                  <div className="mt-6 space-y-3">
                    <div className="h-10 rounded-xl bg-white border border-gray-200" />
                    <div className="h-10 rounded-xl bg-white border border-gray-200" />
                    <div className="h-10 rounded-xl bg-white border border-gray-200" />
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6">
                  <div className="text-2xl text-[#07004C] font-medium mb-3">
                    Send a qualified inquiry
                  </div>
                  <div className="text-gray-600">
                    Structured details → better responses → better conversions.
                  </div>
                  <div className="mt-6 space-y-3">
                    <div className="h-10 rounded-xl bg-gray-50 border border-gray-200" />
                    <div className="h-10 rounded-xl bg-gray-50 border border-gray-200" />
                    <div className="h-10 rounded-xl bg-[#42E2B7]/15 border border-[#42E2B7]/25" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepBubble({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0076FF] to-[#42E2B7] flex items-center justify-center shadow-xl">
        <div className="text-white text-3xl font-medium">
          {number}
        </div>
      </div>
      <div className="mt-4 text-xl text-[#07004C] font-medium">
        {label}
      </div>
    </div>
  );
}

function KeyBenefit({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-white/85 rounded-3xl p-8 border border-gray-200 shadow-md">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#0076FF]/10 text-[#0076FF] flex items-center justify-center">
          {icon}
        </div>
        <div className="text-2xl text-[#07004C] font-medium">
          {title}
        </div>
      </div>
      <div className="text-gray-700 text-lg">{text}</div>
    </div>
  );
}

function MatrixHeader({ text }: { text: string }) {
  return (
    <div className="p-6 text-lg font-medium text-[#07004C]">
      {text}
    </div>
  );
}

function MatrixRow({
  name,
  logoSrc,
  values,
  highlight,
}: {
  name: string;
  logoSrc?: string;
  values: Array<"yes" | "partial" | "no">;
  highlight?: boolean;
}) {
  return (
    <div className={`grid grid-cols-[260px_repeat(4,1fr)] ${highlight ? "bg-[#0076FF]/5" : "bg-white"}`}>
      <div className="p-6 text-xl text-[#07004C] font-medium">
        <div className="flex items-center gap-3">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={`${name} logo`}
              className="h-8 w-8 rounded-md object-contain bg-white"
            />
          ) : null}
          <span>{name}</span>
        </div>
      </div>
      {values.map((v, index) => (
        <div
          key={`${name}-${index}`}
          className="p-6 flex items-center justify-center"
        >
          {v === "yes" ? (
            <CheckCircle2 className="text-[#42E2B7]" size={28} />
          ) : v === "partial" ? (
            <AlertTriangle className="text-[#0076FF]" size={28} />
          ) : (
            <XCircle className="text-gray-400" size={28} />
          )}
        </div>
      ))}
    </div>
  );
}

function ExpectationCard({
  title,
  users,
  treatments,
  accent,
}: {
  title: string;
  users: string;
  treatments: string;
  accent: string;
}) {
  return (
    <div
      className="bg-white/85 rounded-3xl p-10 border-2 shadow-xl h-full flex flex-col"
      style={{ borderColor: accent }}
    >
      <div className="text-2xl text-[#07004C] font-medium mb-8">
        {title}
      </div>
      <div className="space-y-6">
        <div>
          <div className="text-5xl font-medium" style={{ color: accent }}>
            {users}
          </div>
          <div className="text-gray-600 mt-1">
            monthly uniques (Y3 run-rate)
          </div>
        </div>
        <div>
          <div className="text-5xl font-medium text-[#07004C]">
            {treatments}
          </div>
          <div className="text-gray-600 mt-1">
            treatments (Y3)
          </div>
        </div>
      </div>
      <div className="flex-1" />
    </div>
  );
}

function KpiPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-4 rounded-full bg-white/85 border border-gray-200 shadow-md">
      <div className="text-gray-500 text-sm">{label}</div>
      <div className="text-[#07004C] text-2xl font-medium">
        {value}
      </div>
    </div>
  );
}

function Bar({
  label,
  valueLabel,
  heightPct,
  color,
}: {
  label: string;
  valueLabel: string;
  heightPct: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-stretch h-full">
      <div className="flex-1 flex flex-col justify-end">
        <div
          className="w-full rounded-3xl shadow-xl flex items-end justify-center pb-6"
          style={{
            height: `${heightPct}%`,
            background: `linear-gradient(180deg, ${color} 0%, rgba(66,226,183,0.85) 100%)`,
          }}
        >
          <div className="text-[#07004C] text-3xl font-medium">
            {valueLabel}
          </div>
        </div>
      </div>
      <div className="mt-6 text-center text-xl text-[#07004C]">
        {label}
      </div>
    </div>
  );
}

function TeamCard({
  role,
  name,
  highlights,
}: {
  role: string;
  name: string;
  highlights: string[];
}) {
  return (
    <div className="bg-white/85 rounded-3xl p-10 border border-gray-200 shadow-xl">
      <div className="text-gray-500 text-lg mb-2">{role}</div>
      <div className="text-3xl text-[#07004C] font-medium mb-6">
        {name}
      </div>
      <div className="space-y-3">
        {highlights.map((h) => (
          <div key={h} className="flex items-center gap-3 text-gray-700">
            <CheckCircle2 size={18} className="text-[#42E2B7]" />
            <span className="text-lg">{h}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverSlide() {
  return (
    <SlideLayout backgroundSrc={doctorBg} tintColor="#0076FF">
      <div className="h-full flex flex-col items-center justify-center text-center">
        <img
          src={logoImg}
          alt="FindMyDoc Logo"
          className="w-[700px] mb-16"
        />
        <p className="text-4xl text-[#07004C] mb-6">
          Trust-Based Medical Tourism Platform
        </p>
        <p className="text-2xl text-gray-600 max-w-3xl">
          Connecting international patients with verified clinics
        </p>
      </div>
    </SlideLayout>
  );
}

function ProblemSlide() {
  return (
    <SlideLayout
      title="The Problem"
      backgroundSrc={hospitalBg}
      tintColor="#07004C"
    >
      <div className="h-full flex items-center justify-center">
        <div className="grid grid-cols-2 gap-12 w-full">
        {/* Patients Side */}
        <div className="flex flex-col items-center">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#42E2B7] to-[#0076FF] flex items-center justify-center mb-8">
            <Users size={64} className="text-white" />
          </div>
          <h3 className="text-3xl text-[#07004C] mb-8">
            Patients
          </h3>

          <div className="space-y-6 w-full">
            <ProblemCard
              icon={<Search size={32} />}
              text="Too many options, hard to compare"
            />
            <ProblemCard
              icon={<Shield size={32} />}
              text="Trust barrier & hidden fees"
            />
            <ProblemCard
              icon={<MessageSquare size={32} />}
              text="Fragmented journey"
            />
          </div>
        </div>

        {/* Clinics Side */}
        <div className="flex flex-col items-center">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#0076FF] to-[#42E2B7] flex items-center justify-center mb-8">
            <Building2 size={64} className="text-white" />
          </div>
          <h3 className="text-3xl text-[#07004C] mb-8">
            Clinics
          </h3>

          <div className="space-y-6 w-full">
            <ProblemCard
              icon={<XCircle size={32} />}
              text="Low-quality leads"
            />
            <ProblemCard
              icon={<TrendingDown size={32} />}
              text="Dependency on intermediaries"
            />
            <ProblemCard
              icon={<BarChart3 size={32} />}
              text="No measurable ROI"
            />
          </div>
        </div>
      </div>
      </div>
    </SlideLayout>
  );
}

function ProblemCard({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-6 border border-gray-200">
      <div className="text-[#0076FF] flex-shrink-0">{icon}</div>
      <p className="text-lg text-gray-700">{text}</p>
    </div>
  );
}

function WhatIsSlide() {
  return (
    <SlideLayout title="So, what is findmydoc?" backgroundSrc={doctorBg} tintColor="#0076FF">
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-7xl">
          <div className="grid grid-cols-3 gap-6 auto-rows-fr items-stretch">
            <InfoCard
              icon={<FileCheck size={40} />}
              title="Verification"
              color="#0076FF"
            />
            <InfoCard
              icon={<BarChart3 size={40} />}
              title="Comparability"
              color="#42E2B7"
            />
            <InfoCard
              icon={<Target size={40} />}
              title="Qualified inquiry"
              color="#0076FF"
            />

            <InfoCard
              icon={<MessageSquare size={40} />}
              title="Secure chat"
              color="#42E2B7"
            />

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#0076FF]/15 to-[#42E2B7]/15 blur-xl" />
              <img
                src={logoImg}
                alt="findmydoc"
                className="relative w-56"
              />
            </div>

            <InfoCard
              icon={<Lightbulb size={40} />}
              title="AI/UX assist"
              color="#0076FF"
            />
            <InfoCard
              icon={<TrendingUp size={40} />}
              title="Clinic analytics"
              color="#42E2B7"
            />
            <InfoCard
              icon={<Shield size={40} />}
              title="Workflow management"
              color="#0076FF"
            />

            <InfoCard
              icon={<Shield size={40} />}
              title="Trust & policies"
              color="#42E2B7"
            />
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function WhoUsesSlide() {
  return (
    <SlideLayout title="Who uses findmydoc?" backgroundSrc={hospitalBg} tintColor="#42E2B7">
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-7xl grid grid-cols-[1fr_1.6fr_1fr] items-start gap-14 pt-4">
          <UseSide
            align="right"
            title="Clinics (providers)"
            color="#0076FF"
            icon={<Building2 size={46} />}
            bullets={[
              "Turn fewer, better inquiries into treatments",
              "Reduce intermediary dependency & margin pressure",
              "Measure response time, conversion and ROI",
            ]}
          />

          <div className="flex flex-col items-center justify-center">
            <LaptopMock screenshotSrc={websiteScreenshot} />
            <div className="mt-6 text-gray-600 text-lg bg-white/60 border border-gray-200 rounded-full px-5 py-2">
              Supply ↔ Demand
            </div>
          </div>

          <UseSide
            align="left"
            title="International self-pay patients"
            color="#42E2B7"
            icon={<Users size={46} />}
            bullets={[
              "Compare verified clinics in a standardized way",
              "Understand scope + pricing with transparent offers",
              "Send qualified inquiries via a secure workflow",
            ]}
          />
        </div>
      </div>
    </SlideLayout>
  );
}

function UseSide({
  align,
  title,
  color,
  icon,
  bullets,
  tags,
}: {
  align: "left" | "right";
  title: string;
  color: string;
  icon: React.ReactNode;
  bullets: string[];
  tags?: string[];
}) {
  const isRight = align === "right";
  return (
    <div className={`flex flex-col ${isRight ? "items-end text-right" : "items-start text-left"}`}>
      <div
        className="w-32 h-32 rounded-full flex items-center justify-center shadow-2xl mb-8"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, rgba(66,226,183,1) 100%)`,
        }}
      >
        <div className="text-white">{icon}</div>
      </div>

      <div className="text-3xl text-[#07004C] font-medium mb-6">
        {title}
      </div>

      <ul className="space-y-4 max-w-[420px]">
        {bullets.map((b) => (
          <li
            key={b}
            className={`flex items-start gap-3 ${isRight ? "flex-row-reverse" : ""}`}
          >
            <CheckCircle2
              size={22}
              className="text-[#42E2B7] flex-shrink-0 mt-1"
            />
            <span className="text-xl text-gray-700 leading-snug">
              {b}
            </span>
          </li>
        ))}
      </ul>

      {tags?.length ? (
        <div className={`mt-10 flex flex-wrap gap-3 ${isRight ? "justify-end" : "justify-start"}`}>
          {tags.map((t) => (
            <MiniPill key={t} label={t} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HowItWorksSlide() {
  return (
    <SlideLayout title="How it actually works" backgroundSrc={doctorBg} tintColor="#0076FF">
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-7xl">
          <div className="grid grid-cols-6 gap-6">
            <StepBubble number="1" label="Pick treatment" />
            <StepBubble number="2" label="Compare clinics" />
            <StepBubble number="3" label="Check trust (verified)" />
            <StepBubble number="4" label="Send qualified inquiry" />
            <StepBubble number="5" label="Receive offer/response" />
            <StepBubble number="6" label="Book treatment" />
          </div>

          <div className="mt-14 bg-gradient-to-r from-[#0076FF]/10 to-[#42E2B7]/10 rounded-3xl p-10 border-2 border-[#42E2B7]/25">
            <div className="grid grid-cols-3 gap-8">
              <KeyBenefit
                icon={<Shield size={28} />}
                title="Trust by design"
                text="Verified profiles, clear policies, transparent ranking logic."
              />
              <KeyBenefit
                icon={<Target size={28} />}
                title="Quality over volume"
                text="Structured inquiries that lead to real treatments."
              />
              <KeyBenefit
                icon={<BarChart3 size={28} />}
                title="Measurable outcomes"
                text="Clinics see response times, conversion, and ROI clarity."
              />
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function SolutionSlide() {
  return (
    <SlideLayout title="Our Solution" backgroundSrc={doctorBg} tintColor="#42E2B7">
      <div className="h-full flex flex-col justify-center">
        {/* Core Features */}
        <div className="grid grid-cols-3 gap-8 mb-10">
          <FeatureCard
            icon={<FileCheck size={56} />}
            title="Verification"
            color="#0076FF"
          />
          <FeatureCard
            icon={<BarChart3 size={56} />}
            title="Comparison"
            color="#42E2B7"
          />
          <FeatureCard
            icon={<Target size={56} />}
            title="Qualification"
            color="#0076FF"
          />
        </div>

        {/* Trust Framework Visual */}
        <div className="bg-gradient-to-br from-[#0076FF]/10 to-[#42E2B7]/10 rounded-3xl p-12 border-2 border-[#42E2B7]/30">
          <h3 className="text-4xl text-[#07004C] text-center mb-12">
            Trust Framework
          </h3>

          <div className="grid grid-cols-4 gap-6">
            <TrustPillar
              icon={<Shield size={48} />}
              label="Transparency"
            />
            <TrustPillar
              icon={<FileCheck size={48} />}
              label="Itemized Quotes"
            />
            <TrustPillar
              icon={<MessageSquare size={48} />}
              label="No-Pressure"
            />
            <TrustPillar
              icon={<Globe size={48} />}
              label="EU-Compliant"
            />
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function FeatureCard({
  icon,
  title,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-8 border-2 shadow-lg hover:shadow-xl transition-all"
      style={{ borderColor: color }}
    >
      <div
        className="flex justify-center mb-4"
        style={{ color }}
      >
        {icon}
      </div>
      <h3 className="text-2xl text-center text-[#07004C]">
        {title}
      </h3>
    </div>
  );
}

function TrustPillar({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-24 h-24 rounded-full bg-white border-2 border-[#0076FF] flex items-center justify-center mb-4 shadow-md">
        <div className="text-[#0076FF]">{icon}</div>
      </div>
      <p className="text-lg text-[#07004C] text-center">
        {label}
      </p>
    </div>
  );
}

function MarketSlide() {
  return (
    <SlideLayout title="Market Opportunity" backgroundSrc={hospitalBg} tintColor="#42E2B7">
      <div className="h-full flex flex-col justify-center">
        <div className="grid grid-cols-3 gap-8 mb-8">
          <StatCard
            value="1.5M"
            label="Health Tourists"
            sublabel="Turkey 2024"
            color="#42E2B7"
            icon={<Users size={48} />}
          />
          <StatCard
            value="€3.0B"
            label="Revenue"
            sublabel="Total Market"
            color="#0076FF"
            icon={<DollarSign size={48} />}
          />
        <StatCard
          value="~€2,000"
          label="Avg. revenue per health tourist"
          sublabel="Turkey 2024 (market statistic)"
          color="#42E2B7"
          icon={<TrendingUp size={48} />}
        />
        </div>

        {/* Focus Strategy */}
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-10 border-2 border-gray-200">
          <h3 className="text-4xl text-[#07004C] text-center mb-8">
            Beachhead Strategy
          </h3>

          <div className="flex items-center justify-center gap-8">
            <CategoryCircle
              label="Turkey"
              size="large"
              icon={<Flag size={56} className="text-white" />}
            />
            <ArrowRight size={48} className="text-[#0076FF]" />
            <CategoryCircle
              label="South Korea"
              size="large"
              icon={<Flag size={56} className="text-white" />}
            />
            <ArrowRight size={48} className="text-[#0076FF]" />
            <CategoryCircle
              label="International"
              size="large"
              icon={<Globe size={56} className="text-white" />}
            />
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function StatCard({
  value,
  label,
  sublabel,
  color,
  icon,
}: {
  value: string;
  label: string;
  sublabel: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-8 border-2 shadow-lg"
      style={{ borderColor: color }}
    >
      <div
        className="flex justify-center mb-4"
        style={{ color }}
      >
        {icon}
      </div>
      <div
        className="text-5xl text-center mb-2"
        style={{ color }}
      >
        {value}
      </div>
      <div className="text-xl text-center text-[#07004C] mb-1">
        {label}
      </div>
      <div className="text-sm text-center text-gray-500">
        {sublabel}
      </div>
    </div>
  );
}

function CategoryCircle({
  label,
  size,
  icon,
}: {
  label: string;
  size: "large";
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#0076FF] to-[#42E2B7] flex items-center justify-center shadow-lg">
        {icon ?? <CheckCircle2 size={56} className="text-white" />}
      </div>
      <p className="text-xl text-[#07004C] mt-4">{label}</p>
    </div>
  );
}

function CompetitorAnalysisSlide() {
  return (
    <SlideLayout title="Competitor Analysis" backgroundSrc={hospitalBg} tintColor="#07004C">
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-7xl">
          <div className="bg-white/80 rounded-3xl border border-gray-200 overflow-hidden shadow-lg">
            <div className="grid grid-cols-[260px_repeat(4,1fr)] bg-gray-50 border-b border-gray-200">
              <div className="p-6 text-lg font-medium text-[#07004C]">
                Platform
              </div>
              <MatrixHeader text="Verified & standardized" />
              <MatrixHeader text="Comparable" />
              <MatrixHeader text="Qualified inquiry flow" />
              <MatrixHeader text="ROI / analytics" />
            </div>

            <MatrixRow
              name="findmydoc"
              highlight
              values={["yes", "yes", "yes", "yes"]}
            />
            <MatrixRow
              name="Bookimed"
              values={["partial", "partial", "partial", "no"]}
            />
            <MatrixRow
              name="FlyMedi"
              values={["partial", "partial", "partial", "no"]}
            />
            <MatrixRow
              name="WhatClinic"
              values={["no", "partial", "no", "no"]}
            />
          </div>

          <div className="mt-10 flex justify-center">
            <div className="max-w-4xl rounded-3xl border border-gray-200 bg-white/70 px-10 py-7 shadow-lg text-center">
              <div className="text-3xl text-[#07004C] leading-snug">
                Not{" "}
                <span className="text-gray-500">
                  “more leads”
                </span>
                , but{" "}
                <span className="text-[#0076FF] font-medium">
                  better decisions
                </span>{" "}
                +{" "}
                <span className="text-[#42E2B7] font-medium">
                  higher-quality conversions
                </span>
                .
              </div>
              <div className="mt-3 text-lg text-gray-600">
                Designed for trust, comparability, and measurable outcomes.
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function ExpectationsSlide() {
  return (
    <SlideLayout title="Our expectations in 3 years" backgroundSrc={doctorBg}>
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-7xl">
          <div className="grid grid-cols-3 gap-8">
            <ExpectationCard
              title="Conservative"
              users="80k"
              treatments="3,200"
              accent="#0076FF"
            />
            <ExpectationCard
              title="Realistic"
              users="180k"
              treatments="9,000"
              accent="#42E2B7"
            />
            <ExpectationCard
              title="Optimistic"
              users="250k"
              treatments="12,200"
              accent="#0076FF"
            />
          </div>

          <div className="mt-12 bg-gradient-to-r from-[#0076FF]/10 to-[#42E2B7]/10 rounded-3xl p-10 border-2 border-[#42E2B7]/25">
            <div className="grid grid-cols-2 gap-10">
              <div className="text-xl text-gray-700 leading-relaxed">
                <div className="text-[#07004C] text-2xl font-medium mb-2">
                  Monthly uniques (Y3 run-rate)
                </div>
                A defensible demand ramp focused on trust + conversion quality.
              </div>
              <div className="text-xl text-gray-700 leading-relaxed">
                <div className="text-[#07004C] text-2xl font-medium mb-2">
                  Treatments (Y3)
                </div>
                Driven by structured inquiries, verified providers, and clear ROI.
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function UnitEconomicsSlide() {
  return (
    <SlideLayout title="Unit economics" backgroundSrc={hospitalBg}>
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-7xl">
          <div className="flex items-center justify-center gap-4 mb-10">
            <KpiPill label="Avg treatment value (assumption)" value="€3,500" />
            <KpiPill label="Take rate" value="10%" />
            <KpiPill label="Commission / case" value="€350" />
          </div>

          <div className="bg-white/80 rounded-3xl p-10 border border-gray-200 shadow-lg">
            <div className="text-2xl text-[#07004C] font-medium mb-8">
              Year‑3 commission (illustrative)
            </div>

            <div className="grid grid-cols-3 gap-8 items-end h-[420px]">
              <Bar
                label="Conservative"
                valueLabel="€1.12M"
                heightPct={26}
                color="#0076FF"
              />
              <Bar
                label="Realistic"
                valueLabel="€3.15M"
                heightPct={74}
                color="#42E2B7"
              />
              <Bar
                label="Optimistic"
                valueLabel="€4.27M"
                heightPct={100}
                color="#0076FF"
              />
            </div>

            <div className="mt-8 text-gray-600 text-lg">
              Commission = GMV × 10%
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function OutlookSlide() {
  return (
    <SlideLayout
      title="3-Year Outlook"
      backgroundSrc={hospitalBg}
      tintColor="#0076FF"
    >
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-7xl">
          <div className="grid grid-cols-3 gap-8 mb-10 auto-rows-fr items-stretch">
            <ExpectationCard
              title="Conservative"
              users="80k"
              treatments="3,200"
              accent="#0076FF"
            />
            <ExpectationCard
              title="Realistic"
              users="180k"
              treatments="9,000"
              accent="#42E2B7"
            />
            <ExpectationCard
              title="Optimistic"
              users="250k"
              treatments="12,200"
              accent="#0076FF"
            />
          </div>

          <div className="grid grid-cols-2 gap-10 auto-rows-fr items-stretch">
            <div className="bg-white/80 rounded-3xl p-10 border border-gray-200 shadow-lg h-full flex flex-col">
              <div className="text-2xl text-[#07004C] font-medium mb-8">
                Unit economics (baseline)
              </div>
              <div className="flex flex-wrap gap-4">
                <KpiPill label="Avg treatment value (assumption)" value="€3,500" />
                <KpiPill label="Take rate" value="10%" />
                <KpiPill label="Commission / case" value="€350" />
              </div>
              <div className="mt-6 text-gray-600 text-lg">
                Commission = GMV × 10%
              </div>
              <div className="flex-1" />
            </div>

            <div className="bg-white/80 rounded-3xl p-10 border border-gray-200 shadow-lg h-full flex flex-col">
              <div className="text-2xl text-[#07004C] font-medium mb-8">
                Year‑3 commission (illustrative)
              </div>
              <div className="grid grid-cols-3 gap-6 items-end flex-1 min-h-0">
                <Bar
                  label="Cons."
                  valueLabel="€1.12M"
                  heightPct={26}
                  color="#0076FF"
                />
                <Bar
                  label="Real."
                  valueLabel="€3.15M"
                  heightPct={74}
                  color="#42E2B7"
                />
                <Bar
                  label="Opt."
                  valueLabel="€4.27M"
                  heightPct={100}
                  color="#0076FF"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function UseOfFundsSlide() {
  const slices = [
    { label: "Product & Trust", color: "#0076FF", pct: 32 },
    { label: "Demand Gen", color: "#42E2B7", pct: 22 },
    { label: "Supply (Onboarding)", color: "#07004C", pct: 18 },
    { label: "Compliance / Legal", color: "#6B7280", pct: 16 },
    { label: "Ops / Data", color: "#9CA3AF", pct: 12 },
  ];

  const background = `conic-gradient(${slices
    .map((s, index) => {
      const start = slices
        .slice(0, index)
        .reduce((sum, x) => sum + x.pct, 0);
      const end = start + s.pct;
      return `${s.color} ${start}% ${end}%`;
    })
    .join(", ")})`;

  return (
    <SlideLayout title="Use of funds (12–18 months)" backgroundSrc={doctorBg}>
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-7xl grid grid-cols-2 gap-12 items-center">
          <div className="flex items-center justify-center">
            <div className="relative w-[420px] h-[420px] rounded-full shadow-xl border border-gray-200 bg-white/70 flex items-center justify-center">
              <div
                className="absolute inset-5 rounded-full"
                style={{ background }}
              />
              <div className="absolute inset-[120px] rounded-full bg-white/85 border border-gray-200" />
              <div className="relative text-center">
                <div className="text-4xl text-[#07004C] font-medium">
                  € —
                </div>
                <div className="text-gray-600 mt-2">
                  Total budget
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white/80 rounded-3xl border border-gray-200 overflow-hidden shadow-lg">
              <div className="grid grid-cols-[1fr_120px_1fr] bg-gray-50 border-b border-gray-200">
                <div className="p-5 text-[#07004C] font-medium">
                  Area
                </div>
                <div className="p-5 text-[#07004C] font-medium text-right">
                  €
                </div>
                <div className="p-5 text-[#07004C] font-medium">
                  Outcome
                </div>
              </div>

              {slices.map((s) => (
                <div
                  key={s.label}
                  className="grid grid-cols-[1fr_120px_1fr] border-b border-gray-100 last:border-b-0"
                >
                  <div className="p-5 flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-lg text-gray-800">
                      {s.label}
                    </span>
                  </div>
                  <div className="p-5 text-right text-lg text-gray-700">
                    € —
                  </div>
                  <div className="p-5 text-lg text-gray-700">
                    —
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-gray-600">
              Fill in the € amounts + outcomes once the plan is finalized.
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function TeamSlide() {
  return (
    <SlideLayout title="Team" backgroundSrc={hospitalBg} tintColor="#42E2B7">
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-7xl">
          <div className="grid grid-cols-6 gap-8">
            <TeamMemberCard
              role="CTO"
              name="Sebastian Schütze"
              colSpan={2}
              colStart={2}
              photoSrc={teamCtoImg}
            />
            <TeamMemberCard
              role="CEO"
              name="Volkan Kablan"
              colSpan={2}
              colStart={4}
              photoSrc={teamCeoImg}
            />

            <TeamMemberCard
              role="Director Sales"
              name="Anil Goekduman"
              colSpan={2}
              photoSrc={teamDirectorSalesImg}
            />
            <TeamMemberCard
              role="Director Operations"
              name="Özen Günes"
              colSpan={2}
              photoSrc={teamDirectorOpsImg}
            />
            <TeamMemberCard
              role="Director Marketing"
              name="Youssef Adlah"
              colSpan={2}
              photoSrc={teamDirectorMarketingImg}
            />
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function TeamMemberCard({
  role,
  name,
  colSpan,
  colStart,
  photoSrc,
}: {
  role: string;
  name: string;
  colSpan: 2 | 3;
  colStart?: 1 | 2 | 3 | 4 | 5;
  photoSrc?: string;
}) {
  return (
    <div
      className="bg-white/85 rounded-3xl border border-gray-200 shadow-xl p-8 h-full flex flex-col items-start text-left"
      style={{
        gridColumn: colStart
          ? `${colStart} / span ${colSpan}`
          : `span ${colSpan} / span ${colSpan}`,
      }}
    >
      <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-[#0076FF] to-[#42E2B7] flex items-center justify-center">
        {photoSrc ? (
          <img
            src={photoSrc}
            alt={`${name} photo`}
            className="w-full h-full object-cover"
          />
        ) : (
          <Users size={44} className="text-white opacity-90" />
        )}
      </div>

      <div className="mt-6 text-gray-500 text-base">{role}</div>
      <div className="text-2xl text-[#07004C] font-medium mt-1">
        {name}
      </div>
    </div>
  );
}

function SummarySlide() {
  return (
    <SlideLayout title="Summary" backgroundSrc={doctorBg} tintColor="#0076FF">
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-6xl">
          <div className="bg-white/85 rounded-3xl p-12 border border-gray-200 shadow-xl">
            <div className="text-3xl text-[#07004C] font-medium mb-10 text-center">
              findmydoc turns medical tourism into a trusted, comparable decision flow.
            </div>

            <div className="grid grid-cols-3 gap-8">
              <SummaryBullet
                icon={<AlertTriangle size={28} />}
                title="Why it matters"
                text="Trust gap • Transparency gap • High friction"
              />
              <SummaryBullet
                icon={<Shield size={28} />}
                title="What we build"
                text="Verification • Standardized profiles • Comparison"
              />
              <SummaryBullet
                icon={<Target size={28} />}
                title="How we win"
                text="Qualified inquiries • Secure workflow • Analytics"
              />
              <SummaryBullet
                icon={<Globe size={28} />}
                title="Go-to-market"
                text="Turkey → South Korea → International"
              />
              <SummaryBullet
                icon={<DollarSign size={28} />}
                title="Business model"
                text="Subscriptions • Add-ons • 10% commission"
              />
              <SummaryBullet
                icon={<TrendingUp size={28} />}
                title="3-year outlook"
                text="80k/180k/250k users • 3.2k/9k/12.2k treatments"
              />
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function SummaryBullet({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-white rounded-3xl p-7 border border-gray-200 shadow-md">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#0076FF]/10 text-[#0076FF] flex items-center justify-center">
          {icon}
        </div>
        <div className="text-xl text-[#07004C] font-medium">
          {title}
        </div>
      </div>
      <div className="text-gray-700 text-lg leading-snug">{text}</div>
    </div>
  );
}

function BusinessModelSlide() {
  return (
    <SlideLayout title="Business Model" backgroundSrc={doctorBg} tintColor="#0076FF">
      {/* Revenue Streams */}
      <div className="grid grid-cols-3 gap-8 mb-10">
        <RevenueCircle
          icon={<Building2 size={56} />}
          title="Subscriptions"
          subtitle="Basic → Pro"
          color="#0076FF"
        />
        <RevenueCircle
          icon={<Zap size={56} />}
          title="Add-ons"
          subtitle="Premium Features"
          color="#42E2B7"
        />
        <RevenueCircle
          icon={<DollarSign size={56} />}
          title="Commission"
          subtitle="10% Take Rate"
          color="#0076FF"
        />
      </div>

      {/* Unit Economics */}
      <div className="flex-1 bg-gradient-to-br from-[#0076FF]/10 to-[#42E2B7]/10 rounded-3xl p-12 border-2 border-[#42E2B7]/30 min-h-0">
        <h3 className="text-4xl text-[#07004C] text-center mb-12">
          Unit Economics
        </h3>

        <div className="flex items-center justify-center gap-12">
          <UnitBox value="€3,500" label="Avg. treatment value (assumption)" />
          <div className="text-6xl text-[#0076FF]">×</div>
          <UnitBox value="10%" label="Take Rate" />
          <div className="text-6xl text-[#0076FF]">=</div>
          <UnitBox
            value="€350"
            label="Commission"
            highlighted
          />
        </div>
      </div>
    </SlideLayout>
  );
}

function RevenueCircle({
  icon,
  title,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-40 h-40 rounded-full flex items-center justify-center mb-6 shadow-xl"
        style={{ backgroundColor: color }}
      >
        <div className="text-white">{icon}</div>
      </div>
      <h3 className="text-2xl text-[#07004C] mb-2">{title}</h3>
      <p className="text-lg text-gray-600">{subtitle}</p>
    </div>
  );
}

function UnitBox({
  value,
  label,
  highlighted,
}: {
  value: string;
  label: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-8 ${highlighted ? "bg-[#42E2B7] text-white shadow-xl" : "bg-white border-2 border-gray-200"}`}
    >
      <div
        className={`text-5xl text-center mb-2 ${highlighted ? "text-white" : "text-[#0076FF]"}`}
      >
        {value}
      </div>
      <div
        className={`text-lg text-center ${highlighted ? "text-white" : "text-gray-600"}`}
      >
        {label}
      </div>
    </div>
  );
}

function GrowthSlide() {
  return (
    <SlideLayout title="3-Year Projection" backgroundSrc={hospitalBg}>
      {/* Growth Visualization */}
      <div className="h-full flex flex-col min-h-0">
        <div className="grid grid-cols-3 gap-8 mb-12 h-[400px]">
          <YearColumn
            year="Year 1"
            users="25K"
            clinics="50"
            treatments="525"
            revenue="€184K"
            height="40%"
          />
          <YearColumn
            year="Year 2"
            users="75K"
            clinics="180"
            treatments="3,300"
            revenue="€1.16M"
            height="70%"
          />
          <YearColumn
            year="Year 3"
            users="180K"
            clinics="420"
            treatments="11,500"
            revenue="€4.03M"
            height="100%"
          />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-6 bg-gradient-to-r from-[#0076FF]/10 to-[#42E2B7]/10 rounded-2xl p-8 border-2 border-[#42E2B7]/30">
          <MetricBadge
            icon={<Target size={32} />}
            label="5% Conversion"
          />
          <MetricBadge
            icon={<DollarSign size={32} />}
            label="€3,500 Avg. Value"
          />
          <MetricBadge
            icon={<TrendingUp size={32} />}
            label="10% Take Rate"
          />
        </div>
      </div>
    </SlideLayout>
  );
}

function YearColumn({
  year,
  users,
  clinics,
  treatments,
  revenue,
  height,
}: {
  year: string;
  users: string;
  clinics: string;
  treatments: string;
  revenue: string;
  height: string;
}) {
  return (
    <div className="flex flex-col items-stretch h-full">
      <div className="flex-1 flex flex-col justify-end">
        <div
          className="w-full bg-gradient-to-t from-[#0076FF] to-[#42E2B7] rounded-t-3xl flex flex-col items-center justify-end p-8 shadow-xl"
          style={{ height }}
        >
          <div className="text-white text-center space-y-2">
            <div className="text-4xl mb-2">{revenue}</div>
            <div className="text-sm opacity-80">
              {treatments} treatments
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 text-center">
        <h3 className="text-2xl text-[#07004C] mb-3">{year}</h3>
        <div className="space-y-1 text-gray-600">
          <div className="flex items-center gap-2 justify-center">
            <Users size={16} />
            <span>{users} users</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <Building2 size={16} />
            <span>{clinics} clinics</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBadge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-3 bg-white rounded-xl p-4 border border-gray-200">
      <div className="text-[#0076FF]">{icon}</div>
      <span className="text-lg text-[#07004C]">{label}</span>
    </div>
  );
}

function SWOTSlide() {
  return (
    <SlideLayout
      title="Strategic Position"
      backgroundSrc={doctorBg}
      tintColor="#07004C"
    >
      <div className="h-full flex items-center justify-center pb-6">
        <div className="grid grid-cols-2 gap-8 w-full">
          {/* Strengths & Opportunities */}
          <div className="space-y-6">
            <SWOTCard
              icon={<Star size={40} />}
              title="Strengths"
              color="#42E2B7"
              items={[
                "Trust & transparency focus",
                "Focused market entry (Turkey)",
                "Scalable subscription model",
              ]}
            />
            <SWOTCard
              icon={<Lightbulb size={40} />}
              title="Opportunities"
              color="#0076FF"
              items={[
                "Growing demand for transparency",
                "EU-compliant data flow advantage",
                "Expansion to other markets",
              ]}
            />
          </div>

          {/* Weaknesses & Threats */}
          <div className="space-y-6">
            <SWOTCard
              icon={<AlertTriangle size={40} />}
              title="Challenges"
              color="#FF6B6B"
              items={[
                "Low brand awareness initially",
                "High verification effort",
                "Chicken-egg platform problem",
              ]}
            />
            <SWOTCard
              icon={<Shield size={40} />}
              title="Mitigation"
              color="#0076FF"
              items={[
                "Controlled clinic onboarding",
                "Trust framework with verification",
                "Focus before breadth strategy",
              ]}
            />
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function SWOTCard({
  icon,
  title,
  color,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <div
      className="bg-white rounded-2xl p-6 border-2 shadow-lg"
      style={{ borderColor: color }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div style={{ color }}>{icon}</div>
        <h3 className="text-2xl text-[#07004C]">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckCircle2
              size={20}
              className="flex-shrink-0 mt-0.5"
              style={{ color }}
            />
            <span className="text-gray-700">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PatientStorySlide() {
  return (
    <SlideLayout title="Patient Journey" backgroundSrc={hospitalBg}>
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-5xl">
          <div className="flex justify-center mb-10">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#42E2B7] to-[#0076FF] flex items-center justify-center">
              <Users size={48} className="text-white" />
            </div>
          </div>

          <div className="h-full bg-gradient-to-br from-[#0076FF]/10 to-[#42E2B7]/10 rounded-3xl p-12 border-2 border-[#42E2B7]/30">
            <div className="space-y-8">
              <JourneyStep
                number="1"
                icon={<Search size={32} />}
                title="Discovery"
                description="Sarah searches for affordable dental implants in Turkey"
              />
              <JourneyStep
                number="2"
                icon={<BarChart3 size={32} />}
                title="Comparison"
                description="Compares verified clinics with standardized profiles & transparent pricing"
              />
              <JourneyStep
                number="3"
                icon={<MessageSquare size={32} />}
                title="Qualification"
                description="Sends structured inquiry with medical details via secure channel"
              />
              <JourneyStep
                number="4"
                icon={<FileCheck size={32} />}
                title="Decision"
                description="Receives itemized quotes, compares options, books treatment"
              />
              <JourneyStep
                number="5"
                icon={<Star size={32} />}
                title="Trust Loop"
                description="Leaves verified review, strengthening platform trust"
              />
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function JourneyStep({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-6">
      <div className="w-16 h-16 rounded-full bg-[#0076FF] text-white flex items-center justify-center text-2xl flex-shrink-0">
        {number}
      </div>
      <div className="text-[#42E2B7] flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <h3 className="text-2xl text-[#07004C] mb-2">
          {title}
        </h3>
        <p className="text-lg text-gray-700">{description}</p>
      </div>
    </div>
  );
}

function ClinicImpactSlide() {
  return (
    <SlideLayout title="Clinic Impact" backgroundSrc={doctorBg} tintColor="#0076FF">
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-7xl">
          <div className="flex justify-center mb-10">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#0076FF] to-[#42E2B7] flex items-center justify-center">
              <Building2 size={48} className="text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10">
            {/* Before */}
            <div className="bg-red-50 rounded-3xl p-12 border-2 border-red-200">
              <h3 className="text-4xl text-red-600 mb-8 flex items-center gap-4">
                <XCircle size={36} />
                Before
              </h3>
              <ul className="space-y-6">
                <ClinicProblem text="Unqualified, incomplete inquiries" />
                <ClinicProblem text="Resource-intensive triage" />
                <ClinicProblem text="Unclear ROI tracking" />
                <ClinicProblem text="Dependence on intermediaries" />
              </ul>
            </div>

            {/* After */}
            <div className="bg-gradient-to-br from-[#0076FF]/10 to-[#42E2B7]/10 rounded-3xl p-12 border-2 border-[#42E2B7]">
              <h3 className="text-4xl text-[#0076FF] mb-8 flex items-center gap-4">
                <CheckCircle2 size={36} />
                After
              </h3>
              <ul className="space-y-6">
                <ClinicBenefit text="Structured, qualified leads" />
                <ClinicBenefit text="Efficient prioritization" />
                <ClinicBenefit text="Clear performance dashboard" />
                <ClinicBenefit text="Brand ownership & control" />
              </ul>
            </div>
          </div>

          <div className="mt-10 bg-white rounded-3xl p-8 border-2 border-[#0076FF] text-center">
            <p className="text-3xl text-[#07004C]">
              Better patients, not just more leads
            </p>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}

function ClinicProblem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <XCircle
        size={20}
        className="text-red-500 flex-shrink-0 mt-1"
      />
      <span className="text-xl text-gray-700">{text}</span>
    </li>
  );
}

function ClinicBenefit({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2
        size={20}
        className="text-[#42E2B7] flex-shrink-0 mt-1"
      />
      <span className="text-xl text-gray-700">{text}</span>
    </li>
  );
}

function VisionSlide() {
  return (
    <SlideLayout title="Vision" backgroundSrc={hospitalBg} tintColor="#07004C">
      <div className="h-full flex flex-col items-center justify-center text-center">
        <img
          src={logoImg}
          alt="FindMyDoc Logo"
          className="w-[500px] mb-12"
        />

        <p className="text-3xl max-w-4xl mb-16 leading-relaxed">
          Building a leading platform for{" "}
          <span className="text-[#42E2B7]">
            qualified medical tourism
          </span>
          , where{" "}
          <span className="text-[#0076FF]">
            trust, transparency and process quality
          </span>{" "}
          become the brand.
        </p>

        <div className="grid grid-cols-3 gap-8 max-w-5xl">
          <VisionPillar
            icon={<Shield size={48} />}
            title="Trust"
            description="Verified clinics, traceable standards"
          />
          <VisionPillar
            icon={<Globe size={48} />}
            title="Transparency"
            description="Clear prices, open processes, EU-compliant"
          />
          <VisionPillar
            icon={<TrendingUp size={48} />}
            title="Scalable"
            description="From beachhead to European platform"
          />
        </div>

        <div className="mt-16 text-2xl text-gray-600">
          Ready for the journey?
        </div>
      </div>
    </SlideLayout>
  );
}

function VisionPillar({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-8 border border-gray-200">
      <div className="text-[#42E2B7] mb-4 flex justify-center">
        {icon}
      </div>
      <h3 className="text-2xl mb-3 text-[#07004C]">{title}</h3>
      <p className="text-gray-700">{description}</p>
    </div>
  );
}
