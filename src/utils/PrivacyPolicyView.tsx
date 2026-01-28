import { privacyPolicy } from "@/utils/privacyPolicy";
import { useNavigate } from "react-router";

const formatLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const renderContent = (content: unknown) => {
  if (typeof content === "string") {
    return (
      <p className="text-sm leading-relaxed text-base-content/80">
        {content}
      </p>
    );
  }

  if (Array.isArray(content)) {
    return (
      <ul className="list-disc pl-5 space-y-1 text-sm text-base-content/80">
        {content.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (content && typeof content === "object") {
    return (
      <div className="space-y-4">
        {Object.entries(content as Record<string, unknown>).map(
          ([key, value]) => (
            <div key={key} className="space-y-2">
              <h3 className="text-sm font-semibold text-base-content">
                {formatLabel(key)}
              </h3>
              {renderContent(value)}
            </div>
          ),
        )}
      </div>
    );
  }

  return null;
};

export default function PrivacyPolicyView() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body space-y-4">
            <div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => navigate(-1)}
              >
                Back
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="badge badge-primary badge-outline">Public</span>
              <span className="badge badge-ghost">{privacyPolicy.platform}</span>
              <span className="badge badge-ghost">{privacyPolicy.company}</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-base-content">
                {privacyPolicy.title}
              </h1>
              <p className="text-sm text-base-content/70">
                {privacyPolicy.website}
              </p>
            </div>
            <p className="text-sm leading-relaxed text-base-content/80">
              {privacyPolicy.introduction}
            </p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body">
            <h2 className="text-base font-semibold">Contents</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {privacyPolicy.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="link link-primary text-sm"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </div>
        </div>

        {privacyPolicy.sections.map((section, index) => (
          <section
            key={section.id}
            id={section.id}
            className="card bg-base-100 shadow-sm border border-base-300 scroll-mt-24"
          >
            <div className="card-body space-y-4">
              <div className="flex items-center gap-3">
                <span className="badge badge-outline">{index + 1}</span>
                <h2 className="card-title text-base md:text-lg">
                  {section.title}
                </h2>
              </div>
              {renderContent(section.content)}
            </div>
          </section>
        ))}

      </div>
    </div>
  );
}
