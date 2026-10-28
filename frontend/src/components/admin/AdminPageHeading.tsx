// Presentation only: API calls, parent context and mutation gates stay in each page.
export function AdminPageHeading({
  id,
  title,
  context,
}: {
  id?: string
  title: string
  context: string
}) {
  return (
    <header className="admin-page-heading">
      <p className="eyebrow">{context}</p>
      <h2 id={id}>{title}</h2>
    </header>
  )
}
