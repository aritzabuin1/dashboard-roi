import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    iconSize?: number;
    textSize?: string;
}

export function Logo({ className, iconSize = 32, textSize = "text-3xl" }: LogoProps) {
    return (
        <div className={cn("flex items-center gap-2 select-none", className)}>
            <div className="text-rose-500">
                <Share2 size={iconSize} strokeWidth={2.5} />
            </div>
            <span className={cn("font-bold tracking-tight text-rose-500", textSize)}>
                AI mate
            </span>
        </div>
    );
}
