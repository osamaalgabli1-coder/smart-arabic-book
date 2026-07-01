export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-border">
      <div>
        <h2 className="text-xl font-extrabold text-primary">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}