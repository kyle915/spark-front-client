export function ThemeLivePreview() {
  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-base-content">Live Preview</div>
          <div className="text-xs opacity-70">
            Changes are applied to the global theme in real time.
          </div>
        </div>
        <button className="btn btn-sm btn-primary" type="button">
          Primary
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm btn-secondary" type="button">
          Secondary
        </button>
        <button className="btn btn-sm btn-accent" type="button">
          Accent
        </button>
        <button
          className="btn btn-sm btn-ghost border border-base-300"
          type="button"
        >
          Ghost
        </button>
        <button className="btn btn-sm btn-outline" type="button">
          Outline
        </button>
      </div>

      <div className="alert alert-info">
        <span>Info alert</span>
      </div>
      <div className="alert alert-success">
        <span>Success alert</span>
      </div>
      <div className="alert alert-warning">
        <span>Warning alert</span>
      </div>
      <div className="alert alert-error">
        <span>Error alert</span>
      </div>

      <div className="rounded-xl border border-base-300 bg-base-200 p-4">
        <div className="font-semibold text-base-content">Card sample</div>
        <p className="text-sm opacity-80 mt-1">
          Text using <code>text-base-content</code>.
        </p>
        <div className="mt-3 flex gap-2">
          <span className="badge badge-primary">Primary</span>
          <span className="badge badge-secondary">Secondary</span>
          <span className="badge badge-accent">Accent</span>
        </div>
      </div>
    </div>
  );
}
