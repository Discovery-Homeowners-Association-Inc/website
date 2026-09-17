export function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p class="notice notice--error" role="alert">
      {message}
    </p>
  );
}

export function Saved({ message }: { message: string }) {
  return (
    <p class="notice" role="status" hidden={!message}>
      {message}
    </p>
  );
}

export function Loading() {
  return <p class="meta">Loading…</p>;
}
