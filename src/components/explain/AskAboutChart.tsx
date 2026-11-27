import { useId, useState } from "react";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import AskAiButton from "@/components/ai/AskAiButton";
import { ChartAnswerQuery } from "@/api/queries/ChartAnswerQuery";
import type { ChartAnswerQuery as ChartAnswerQueryType } from "@api/queries/__generated__/ChartAnswerQuery.graphql";
import { cleanChartQuestion, MAX_CHART_QUESTION, type ChartKind } from "@/lib/dashboardExplain";

const META = { color: "var(--spark-text-meta)" } as const;

type Reply = { text: string; answered: boolean; failed: boolean };

/**
 * A quiet "Ask about this chart" under a chart. It opens one question box;
 * the answer comes only from that chart's figures, worked out again on the
 * server from the chart's client, dates and kind. Nothing is sent until the
 * question is submitted.
 */
const AskAboutChart: React.FC<{
  tenantId: string;
  chart: ChartKind;
  startDate: string;
  endDate: string;
  /** The chart's title, for the box's label. */
  title: string;
}> = ({ tenantId, chart, startDate, endDate, title }) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  const inputId = useId();

  const ask = async () => {
    const q = cleanChartQuestion(question);
    if (!q || loading) return;
    setLoading(true);
    setReply(null);
    try {
      const data = await fetchQuery<ChartAnswerQueryType>(
        environment,
        ChartAnswerQuery,
        { tenantId, chart, question: q, startDate, endDate },
        { fetchPolicy: "network-only" },
      ).toPromise();
      const res = data?.chartAnswer;
      if (!res || !res.ok) {
        setReply({
          text: res?.reason || "The question could not be answered right now.",
          answered: false,
          failed: true,
        });
      } else {
        setReply({ text: res.answer, answered: res.answered, failed: false });
      }
    } catch {
      setReply({
        text: "The question could not be answered right now.",
        answered: false,
        failed: true,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs underline self-start print:hidden"
        style={{ ...META, background: "transparent", border: "none", padding: 0 }}
      >
        Ask about this chart
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          A question about {title}
        </label>
        <input
          id={inputId}
          type="text"
          value={question}
          maxLength={MAX_CHART_QUESTION}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="A question about this chart"
          className="spark-input text-sm rounded-lg px-3 py-2 flex-1 min-w-[12rem]"
          autoFocus
        />
        <button
          type="submit"
          className="spark-btn-ghost !px-3 !py-1.5 text-xs"
          disabled={loading || cleanChartQuestion(question) === ""}
        >
          {loading ? "Reading the chart" : "Ask"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReply(null);
          }}
          className="text-xs underline"
          style={{ ...META, background: "transparent", border: "none", padding: 0 }}
        >
          Close
        </button>
      </form>
      {reply ? (
        <p
          className="text-sm leading-relaxed"
          role="status"
          style={{ color: reply.failed ? "var(--spark-text-meta)" : "var(--spark-text)" }}
        >
          {reply.text}
          {!reply.failed && !reply.answered ? (
            <>
              {" "}
              <AskAiButton tenantId={tenantId} variant="text" label="Open Ask Spark" className="underline" />
            </>
          ) : null}
        </p>
      ) : (
        <p className="text-xs" style={META}>
          Answered from this chart's figures only.
        </p>
      )}
    </div>
  );
};

export default AskAboutChart;
