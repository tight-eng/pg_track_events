"use client";

import { useState, useEffect, useRef } from "react";
import { SectionLayout } from "@/components/layouts/section-layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pause } from "lucide-react";
import Image from "next/image";

// Mock event data
const mockEvents = [
  {
    seconds: 3.4,
    event: "SIGN_UP_STARTED",
    from: "CHROME",
    properties: {},
  },
  {
    seconds: 23.99,
    event: "USER_ACCOUNT_CREATED",
    from: "RUBY BACKEND",
    properties: {
      id: "user-xyz2894823892",
      email: "acunniffe+ghtest1@gmail.com",
    },
  },
  {
    seconds: 34,
    from: "RUBY BACKEND",
    event: "USER_EMAIL_VERIFIED",
    properties: {},
  },
  {
    seconds: 40,
    from: "RUBY BACKEND",
    event: "USER_FIRST_LOGIN",
    properties: {
      id: "user-xyz2894823892",
      email: "acunniffe+ghtest1@gmail.com",
    },
  },
  {
    seconds: 49,
    from: "RUBY BACKEND",
    event: "REPOSITORY_CREATED",
    properties: {
      repoName: "example-repo",
    },
  },
  {
    seconds: 80,
    from: "RUBY BACKEND",
    event: "ORGANIZATION_CREATED",
    properties: {
      orgName: "funorgforrepo",
    },
  },
  {
    seconds: 93,
    from: "RUBY BACKEND",
    event: "REPOSITORY_CREATED",
    properties: {
      orgName: "funorgforrepo",
      repoName: "new-repo",
    },
  },
  {
    seconds: 99,
    from: "RUBY BACKEND",
    event: "ISSUE_CREATED",
    properties: {
      orgName: "funorgforrepo",
      repoName: "new-repo",
      issueTitle: "new issue",
    },
  },
];

export default function SessionsPage() {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeEvent, setActiveEvent] = useState<(typeof mockEvents)[0] | null>(
    null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(2);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    // Set initial playback rate
    video.playbackRate = 2;

    const handleLoadedMetadata = () => {
      console.log("Metadata loaded, duration:", video.duration);
      setDuration(video.duration);
    };

    const handleCanPlay = () => {
      console.log("Can play, duration:", video.duration);
      setDuration(video.duration);
    };

    const handleLoadedData = () => {
      console.log("Data loaded, duration:", video.duration);
      setDuration(video.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Check for events at current timestamp
      const event = mockEvents.find(
        (e) => Math.abs(e.seconds - video.currentTime) < 0.5
      );
      if (event) {
        setActiveEvent(event);
        setTimeout(() => setActiveEvent(null), 5000);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    // Add all event listeners
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    // Check if video is already loaded
    if (video.readyState >= 2) {
      console.log("Video already loaded, duration:", video.duration);
      setDuration(video.duration);
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) {
      return;
    }

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = percent * duration;
  };

  const togglePlay = () => {
    if (!videoRef.current) {
      return;
    }
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const changeSpeed = () => {
    if (!videoRef.current) {
      return;
    }
    const rates = [1, 2, 5];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const nextRate = rates[nextIndex];
    videoRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  console.log("DURATION ", duration);
  console.log("PROGRESS ", (currentTime / duration) * 100);
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-[#2a2a2a]">
          Session Replay
        </h1>
        <Button variant="outline">Customize Events</Button>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <video
            ref={videoRef}
            className="w-full rounded-lg"
            src="/github-signup.mp4"
            preload="metadata"
            onLoadedMetadata={(e) => {
              console.log(
                "onLoadedMetadata event, duration:",
                e.currentTarget.duration
              );
              setDuration(e.currentTarget.duration);
              e.currentTarget.playbackRate = 2;
            }}
          />

          {activeEvent && (
            <div className="absolute top-4 right-4 bg-white/90 p-3 rounded-lg shadow-lg">
              <div className="font-medium">{activeEvent.event}</div>
              <div className="text-sm text-gray-600">
                {JSON.stringify(activeEvent.properties)}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlay}
            className="h-8 w-8"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={changeSpeed}
            className="h-8"
          >
            {playbackRate}x
          </Button>

          <div className="flex-1">
            <div
              className="relative"
              ref={progressRef}
              onClick={handleTimelineClick}
            >
              <Progress
                value={duration > 0 ? (currentTime / duration) * 100 : 0}
                className="h-2"
              />

              {mockEvents.map((event) => (
                <TooltipProvider key={event.seconds}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute top-1 w-3 h-3 rounded-full -translate-x-1/2 cursor-pointer -translate-y-1/2 border-2 border-blue-500 bg-white flex items-center justify-center"
                        style={{
                          left:
                            duration > 0
                              ? `${(event.seconds / duration) * 100}%`
                              : "0%",
                        }}
                      >
                        <div className="w-1 h-1 bg-blue-500 rounded-full" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="flex items-center gap-2">
                        {event.from === "RUBY BACKEND" ? (
                          <Image
                            src="/ruby_logo.png"
                            alt="Ruby"
                            width={16}
                            height={16}
                            className="rounded-full"
                          />
                        ) : event.from === "CHROME" ? (
                          <Image
                            src="/chrome_logo.png"
                            alt="Chrome"
                            width={16}
                            height={16}
                            className="rounded-full"
                          />
                        ) : null}
                        <p className="font-medium">{event.event}</p>
                      </div>
                      <p className="text-sm text-gray-600">
                        {JSON.stringify(event.properties)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
