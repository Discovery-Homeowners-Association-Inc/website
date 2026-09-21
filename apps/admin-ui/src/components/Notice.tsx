export function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p class="callout callout--warning" role="alert">
      {message}
    </p>
  );
}

export function Saved({ message }: { message: string }) {
  return (
    <p class="callout" role="status" hidden={!message}>
      {message}
    </p>
  );
}

export function Loading() {
  return <p class="meta">Loading…</p>;
}
