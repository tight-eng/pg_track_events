"use client";
import {
  Home,
  Users,
  FlaskConical,
  Video,
  Workflow,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { name: "Dashboards", icon: Home, href: "/dashboards" },
  { name: "Customers", icon: Users, href: "/customers" },
  { name: "Experiments", icon: FlaskConical, href: "/experiments" },
  { name: "Session Replays", icon: Video, href: "/sessions" },
  { name: "Workflows", icon: Workflow, href: "/workflows" },
];

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col h-full border-r border-[#e8e6e3] w-16 bg-[#f8f6f3]">
      <div className="p-4 border-b border-[#e8e6e3]">
        <div className="flex justify-center items-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-[#2a2a2a]"
          >
            <path
              d="M12 6C10.5 6 9.5 7 9.5 8.5C9.5 9.5 10 10.2 11 10.5C11 11 10.5 11.5 10 11.8C9 12.2 7.5 12 6 11.5C6.5 13 7.5 14 9 14C10 14 10.8 13.5 11 12.5L16 17.5C16.5 18 17.5 18 18 17.5C18.5 17 18.5 16 18 15.5L13 10.5C13.2 10.2 13.5 9.8 13.5 9C14.5 8.7 15 8 15 7C15 5.5 14 4.5 12.5 4.5C12.2 4.5 12 4.5 11.8 4.6L8 1C7.5 0.5 6.5 0.5 6 1C5.5 1.5 5.5 2.5 6 3L9.8 6.6C9.9 6.4 10 6.2 10 6"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M18 7L22 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M6 17L2 21"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      <div className="flex-1 py-4 m-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <TooltipProvider key={item.href}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "mb-2 flex items-center justify-center p-3 hover:bg-[#e8e6e3] hover:rounded-xl transition-colors",
                      isActive && "bg-[#e8e6e3] rounded-xl"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5",
                        isActive ? "text-[#2a2a2a]" : "text-[#666666]"
                      )}
                    />
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-white text-[#2a2a2a] border-[#e8e6e3] shadow-md"
                >
                  <p>{item.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      <div className="border-t border-[#e8e6e3] py-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                className={cn(
                  "flex items-center justify-center p-3 hover:bg-[#e8e6e3] hover:rounded-full transition-colors",
                  pathname.startsWith("/settings") &&
                    "bg-[#e8e6e3] rounded-full"
                )}
              >
                <Settings
                  className={cn(
                    "h-5 w-5",
                    pathname.startsWith("/settings")
                      ? "text-[#2a2a2a]"
                      : "text-[#666666]"
                  )}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="bg-white text-[#2a2a2a] border-[#e8e6e3] shadow-md"
            >
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </nav>
  );
}
