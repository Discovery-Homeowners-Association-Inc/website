import type { MinutesBody } from "@dhoa/shared";

/** Read-only minutes. Used for reviewers, for locked minutes, and inside the printable export. */
export function MinutesView({ body }: { body: MinutesBody }) {
  return (
    <div class="prose minutes-doc">
      <dl class="minutes-facts">
        {body.called_to_order && (
          <>
            <dt>Called to order</dt>
            <dd>{body.called_to_order}</dd>
          </>
        )}
        {body.presiding && (
          <>
            <dt>Presiding</dt>
            <dd>{body.presiding}</dd>
          </>
        )}
        {body.recorded_by && (
          <>
            <dt>Recorded by</dt>
            <dd>{body.recorded_by}</dd>
          </>
        )}
        <dt>Present</dt>
        <dd>{body.present.join(", ") || "Not recorded"}</dd>
        {body.absent.length > 0 && (
          <>
            <dt>Absent</dt>
            <dd>{body.absent.join(", ")}</dd>
          </>
        )}
        {body.guests && (
          <>
            <dt>Also present</dt>
            <dd>{body.guests}</dd>
          </>
        )}
        <dt>Quorum</dt>
        <dd>
          {body.quorum ? "A quorum was present." : "No quorum was recorded."}
        </dd>
      </dl>
      {body.items.map((it, i) => (
        <section id={`item-${it.id}`}>
          <h3>
            {i + 1}. {it.title}
          </h3>
          {it.discussion
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((p) => (
              <p>{p}</p>
            ))}
          {it.motions.map((mo) => (
            <p class="motion">
              <strong>Motion:</strong> {mo.text} Moved by {mo.moved_by}
              {mo.seconded_by && `, seconded by ${mo.seconded_by}`}.{" "}
              <strong>
                {mo.result[0]!.toUpperCase() + mo.result.slice(1)}
              </strong>
              {mo.yes + mo.no + mo.abstain > 0 &&
                ` (${mo.yes} in favor, ${mo.no} against, ${mo.abstain} abstaining)`}
              .
            </p>
          ))}
        </section>
      ))}
      {body.adjourned_at && (
        <p>The meeting was adjourned at {body.adjourned_at}.</p>
      )}
    </div>
  );
}
