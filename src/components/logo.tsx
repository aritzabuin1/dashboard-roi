import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    iconSize?: number;
    textSize?: string;
}

function AiMateIcon({ size = 32 }: { size?: number }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 18.5 25"
            fill="currentColor"
            width={size}
            height={size}
        >
            <path d="M0,19.42c.042-2.268,1.334-3.995,3.53-4.673.895-.276,1.827-.44,2.707-.754,2.278-.812,3.351-2.697,2.902-5.064-.175-.92-.484-1.814-.665-2.733-.566-2.863,1.004-5.324,3.796-5.998,2.628-.635,5.25.865,5.999,3.433.8,2.742-.555,5.332-3.31,6.287-1.095.38-2.246.623-3.303,1.084-1.797.784-2.862,2.626-2.691,4.395.167,1.722,1.442,3.195,3.166,3.566,1.556.335,2.923-.177,4.11-1.155.757-.623,1.412-1.369,2.154-2.012,2.182-1.892,5.155-1.753,7.101.305,1.829,1.934,1.814,5.003-.033,6.926-1.944,2.024-4.825,2.172-7.002.328-.715-.606-1.347-1.307-2.05-1.928-1.933-1.706-4.109-1.717-6.031-.017-.634.561-1.185,1.216-1.799,1.801-1.574,1.5-3.681,1.884-5.577,1.039C1.127,23.413-.039,21.538,0,19.42" />
        </svg>
    );
}

export function Logo({ className, iconSize = 32, textSize = "text-3xl" }: LogoProps) {
    return (
        <div className={cn("flex items-center gap-2 select-none", className)}>
            <div className="text-rose-500">
                <AiMateIcon size={iconSize} />
            </div>
            <span className={cn("font-bold tracking-tight text-rose-500", textSize)}>
                AI mate
            </span>
        </div>
    );
}
