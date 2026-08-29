import { CheckIcon, SparkIcon } from "@/components/icons";

/**
 * The assistant panel mid-turn. What it is showing is the thing worth showing:
 * the model does not answer with instructions, it calls the same tools the
 * canvas calls and the map changes underneath.
 */

const TOOL_CALLS = [
  { name: "create_mindmap", result: "Launch plan" },
  { name: "add_topics", result: "3 topics under Launch plan" },
  { name: "add_topics", result: "5 topics under 3 branches" },
  { name: "set_topic_note", result: "Positioning" },
];

export function AssistantMock() {
  return (
    <div className="flex flex-col gap-4 p-6 text-left sm:p-7">
      <div className="flex items-center gap-2 border-b border-hairline pb-4">
        <SparkIcon className="size-[18px] text-signal-blue" />
        <span className="text-body-sm font-semibold text-ink-navy">
          Assistant
        </span>
        <span className="ml-auto text-caption text-mist-gray">
          Launch plan · 4 tools
        </span>
      </div>

      <p className="ml-auto max-w-[85%] rounded-product rounded-br-[4px] bg-ink-navy px-4 py-3 text-body-sm text-paper">
        I&rsquo;m planning the launch. Break it into positioning, pricing, and
        launch week, and note down who it&rsquo;s for.
      </p>

      <ul className="flex flex-col gap-2">
        {TOOL_CALLS.map((call) => (
          <li
            key={`${call.name}-${call.result}`}
            className="flex items-center gap-3 rounded-input border border-hairline bg-pebble px-3 py-2"
          >
            <CheckIcon className="size-4 shrink-0 text-signal-blue" />
            <code className="font-mono text-caption font-medium text-deep-cobalt">
              {call.name}
            </code>
            <span className="truncate text-caption text-slate-gray">
              {call.result}
            </span>
          </li>
        ))}
      </ul>

      <p className="max-w-[92%] rounded-product rounded-bl-[4px] bg-pebble px-4 py-3 text-body-sm text-ink-navy">
        Built <strong className="font-semibold">Launch plan</strong> with three
        branches. Positioning carries a note on who it&rsquo;s for — open it and
        keep going.
      </p>
    </div>
  );
}
