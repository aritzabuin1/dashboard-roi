import { HelpCircle } from "lucide-react"

interface InfoTooltipProps {
    text: string
}

export function InfoTooltip({ text }: InfoTooltipProps) {
    return (
        <span className="relative inline-flex items-center group ml-1.5">
            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-md px-3 py-2 text-xs leading-relaxed opacity-0 transition-opacity group-hover:opacity-100 bg-popover text-popover-foreground border shadow-md z-50"
            >
                {text}
            </span>
        </span>
    )
}
