interface PageHeaderProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-foreground text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
      </div>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
