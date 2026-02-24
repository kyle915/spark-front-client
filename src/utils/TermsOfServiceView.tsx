import { termsOfService } from "@/utils/TermsOfService";
import { useNavigate } from "react-router";

const subsectionPattern = /^\d+\.\d+\s+/;

type GroupedItem =
  | { type: "item"; text: string }
  | { type: "subsection"; title: string; items: string[] };

const groupArrayContent = (items: string[]): GroupedItem[] => {
  const grouped: GroupedItem[] = [];
  let currentSubsection: { title: string; items: string[] } | null = null;

  for (const item of items) {
    if (subsectionPattern.test(item)) {
      if (currentSubsection) {
        grouped.push({
          type: "subsection",
          title: currentSubsection.title,
          items: currentSubsection.items,
        });
      }

      currentSubsection = { title: item, items: [] };
      continue;
    }

    if (currentSubsection) {
      currentSubsection.items.push(item);
      continue;
    }

    grouped.push({ type: "item", text: item });
  }

  if (currentSubsection) {
    grouped.push({
      type: "subsection",
      title: currentSubsection.title,
      items: currentSubsection.items,
    });
  }

  return grouped;
};

const renderContent = (content: string | string[]) => {
  if (Array.isArray(content)) {
    const groupedItems = groupArrayContent(content);

    return (
      <ul className="list-disc pl-5 space-y-2 text-sm text-base-content/80">
        {groupedItems.map((item, index) => {
          if (item.type === "subsection") {
            return (
              <li key={`${item.title}-${index}`} className="space-y-1">
                <p>{item.title}</p>
                {item.items.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1">
                    {item.items.map((subItem, subIndex) => (
                      <li key={`${item.title}-${subIndex}`}>{subItem}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          }

          return <li key={`${item.text}-${index}`}>{item.text}</li>;
        })}
      </ul>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-base-content/80">{content}</p>
  );
};

export default function TermsOfServiceView() {
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
              <span className="badge badge-ghost">{termsOfService.platform}</span>
              <span className="badge badge-ghost">
                {termsOfService.operatedBy}
              </span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-base-content">
                {termsOfService.title}
              </h1>
              <p className="text-sm text-base-content/70">
                Effective Date: {termsOfService.effectiveDate}
              </p>
              <p className="text-sm text-base-content/70">
                Last Updated: {termsOfService.lastUpdated}
              </p>
              <p className="text-sm text-base-content/70">
                {termsOfService.website}
              </p>
            </div>
            <p className="text-sm leading-relaxed text-base-content/80">
              {termsOfService.introduction}
            </p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body">
            <h2 className="text-base font-semibold">Contents</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {termsOfService.sections.map((section) => (
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

        {termsOfService.sections.map((section, index) => (
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

        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body">
            <p className="text-sm leading-relaxed text-base-content/80">
              {termsOfService.legalNote}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
