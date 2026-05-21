interface PageHeaderProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
