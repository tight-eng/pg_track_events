"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, ChevronRight, ChevronDown, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

interface NavItem {
  id: string;
  title: string;
  href: string;
  type: "view" | "folder";
  items?: NavItem[];
}

interface SecondaryNavProps {
  items: NavItem[];
  onCreateFolder: () => void;
  onCreateView: () => void;
  defaultSelection?: string;
}

export function SecondaryNav({
  items,
  onCreateFolder,
  onCreateView,
  defaultSelection,
}: SecondaryNavProps) {
  const pathname = usePathname();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(
      items.filter((item) => item.type === "folder").map((item) => item.id)
    )
  );

  const getActivePath = () => {
    return defaultSelection || pathname;
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const renderItem = (item: NavItem) => {
    const isActive = getActivePath() === item.href;
    const isFolder = item.type === "folder";
    const isOpen = expandedFolders.has(item.id);

    return (
      <div key={item.id} className="mb-1">
        <div className="flex items-center">
          {isFolder ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 hover:bg-transparent"
              onClick={() => toggleFolder(item.id)}
            >
              {isOpen ? (
                <ChevronDown className="w-3 h-3 text-[#666666]" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[#666666]" />
              )}
            </Button>
          ) : (
            <div className="h-6 w-6" />
          )}
          <Link
            href={item.href}
            className={cn(
              "flex-1 px-2 py-1 text-xs hover:bg-[#e8e6e3] mr-2 hover:rounded-md  transition-colors",
              isActive && "bg-[#e8e6e3] rounded-md "
            )}
          >
            <span
              className={cn(isActive ? "text-[#2a2a2a]" : "text-[#666666]")}
            >
              {item.title}
            </span>
          </Link>
        </div>
        {isFolder && item.items && isOpen && (
          <div className="ml-2 mt-1">
            {item.items.map((child) => renderItem(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="flex flex-col h-full border-r border-[#e8e6e3] w-56 bg-[#f8f6f3]">
      <div className="p-1.5 flex gap-1 justify-end">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-[#666666] hover:text-[#2a2a2a] hover:bg-[#e8e6e3]"
                onClick={onCreateFolder}
              >
                <FolderPlus className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="bg-[#f8f6f3] text-[#2a2a2a] border-[#e8e6e3]"
            >
              <p>New Folder</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-[#666666] hover:text-[#2a2a2a] hover:bg-[#e8e6e3]"
                onClick={onCreateView}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="bg-[#f8f6f3] text-[#2a2a2a] border-[#e8e6e3]"
            >
              <p>New View</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex-1 py-2 overflow-y-auto">
        {items.map((item) => (
          <div key={item.href || item.id || item.title}>{renderItem(item)}</div>
        ))}
      </div>
    </nav>
  );
}
