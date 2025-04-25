"use client";

import {
  ArrowUpRight,
  Database,
  CreditCard,
  BarChart2,
  Clock,
  CheckCircle,
  Settings2,
  X,
  ArrowDownRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { scaleLinear, scaleTime, scaleOrdinal } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { GridRows, GridColumns } from "@visx/grid";
import { curveMonotoneX } from "@visx/curve";
import { Group } from "@visx/group";
import { LegendOrdinal } from "@visx/legend";

// Mock data for different company sizes
const data = {
  all: [
    { date: new Date("2023-10-01"), conversionTime: 55, conversionRate: 0.15 },
    { date: new Date("2023-11-01"), conversionTime: 45, conversionRate: 0.16 },
    { date: new Date("2023-12-01"), conversionTime: 35, conversionRate: 0.17 },
    { date: new Date("2024-01-01"), conversionTime: 25, conversionRate: 0.18 },
    { date: new Date("2024-02-01"), conversionTime: 18, conversionRate: 0.19 },
    { date: new Date("2024-03-01"), conversionTime: 12, conversionRate: 0.2 },
  ],
  small: [
    { date: new Date("2023-10-01"), conversionTime: 55, conversionRate: 0.12 },
    { date: new Date("2023-11-01"), conversionTime: 48, conversionRate: 0.13 },
    { date: new Date("2023-12-01"), conversionTime: 40, conversionRate: 0.14 },
    { date: new Date("2024-01-01"), conversionTime: 32, conversionRate: 0.15 },
    { date: new Date("2024-02-01"), conversionTime: 24, conversionRate: 0.16 },
    { date: new Date("2024-03-01"), conversionTime: 16, conversionRate: 0.17 },
  ],
  medium: [
    { date: new Date("2023-10-01"), conversionTime: 50, conversionRate: 0.18 },
    { date: new Date("2023-11-01"), conversionTime: 42, conversionRate: 0.19 },
    { date: new Date("2023-12-01"), conversionTime: 34, conversionRate: 0.2 },
    { date: new Date("2024-01-01"), conversionTime: 26, conversionRate: 0.21 },
    { date: new Date("2024-02-01"), conversionTime: 20, conversionRate: 0.22 },
    { date: new Date("2024-03-01"), conversionTime: 14, conversionRate: 0.23 },
  ],
  large: [
    { date: new Date("2023-10-01"), conversionTime: 45, conversionRate: 0.22 },
    { date: new Date("2023-11-01"), conversionTime: 38, conversionRate: 0.23 },
    { date: new Date("2023-12-01"), conversionTime: 30, conversionRate: 0.24 },
    { date: new Date("2024-01-01"), conversionTime: 22, conversionRate: 0.25 },
    { date: new Date("2024-02-01"), conversionTime: 16, conversionRate: 0.26 },
    { date: new Date("2024-03-01"), conversionTime: 12, conversionRate: 0.27 },
  ],
};

export default function DashboardsPage() {
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Make width responsive based on settings panel state
  const width = showSettings ? 800 : 1200;
  const height = 320;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Get current data based on active tab
  const currentData = data[activeTab as keyof typeof data];
  const allData = data.all;

  const segmentLabels = {
    all: "All Companies",
    small: "0-50 Employees",
    medium: "50-200 Employees",
    large: "200+ Employees",
  };

  const legendItems = [
    {
      label: "Conversion Rate",
      color: "#3b82f6",
      styles: [
        { label: "All Companies", isDotted: true },
        {
          label: segmentLabels[activeTab as keyof typeof segmentLabels],
          isDotted: false,
        },
      ],
    },
    {
      label: "Conversion Time",
      color: "#10b981",
      styles: [
        { label: "All Companies", isDotted: true },
        {
          label: segmentLabels[activeTab as keyof typeof segmentLabels],
          isDotted: false,
        },
      ],
    },
  ];

  // Scales
  const xScale = scaleTime({
    domain: [allData[0].date, allData[allData.length - 1].date],
    range: [0, innerWidth],
  });

  const yScale = scaleLinear({
    domain: [0, 55],
    range: [innerHeight, 0],
  });

  const yScaleRate = scaleLinear({
    domain: [0, 0.3],
    range: [innerHeight, 0],
  });

  const legendScale = scaleOrdinal({
    domain: legendItems.map((item) => item.label),
    range: legendItems.map((item) => item.color),
  });

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center mb-2 gap-5">
        <h1 className="text-2xl font-semibold text-[#1a1a1a] tracking-tight">
          Time to Convert
        </h1>

        <div className="flex items-center gap-1.5 bg-emerald-50/50 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-100">
          <ArrowDownRight className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">41.2% last 30 days</span>
        </div>
      </div>
      <p className="text-muted-foreground mb-6">
        Tracking conversion time and completion rate for different company
        sizes.
      </p>
      <div className="relative overflow-hidden">
        {/* Main Graph Card */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            showSettings ? "mr-[400px]" : "mr-0"
          }`}
        >
          <Card className="p-4 border-gray-100 bg-transparent shadow-none rounded-none">
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1.5 hover:bg-gray-100 transition-colors flex items-center justify-center"
              >
                {showSettings ? (
                  <X className="h-4 w-4 text-gray-500" />
                ) : (
                  <Settings2 className="h-4 w-4 text-gray-500" />
                )}
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="justify-start bg-transparent">
                  <TabsTrigger
                    value="all"
                    className="text-sm px-4 py-2 border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent hover:bg-transparent"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger
                    value="small"
                    className="text-sm px-4 py-2 border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent hover:bg-transparent"
                  >
                    0-50
                  </TabsTrigger>
                  <TabsTrigger
                    value="medium"
                    className="text-sm px-4 py-2 border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent hover:bg-transparent"
                  >
                    50-200
                  </TabsTrigger>
                  <TabsTrigger
                    value="large"
                    className="text-sm px-4 py-2 border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent hover:bg-transparent"
                  >
                    200+
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Chart */}
            <div className="h-[400px] relative">
              <svg width={width} height={height}>
                <Group left={margin.left} top={margin.top}>
                  <GridRows
                    scale={yScale}
                    width={innerWidth}
                    height={innerHeight}
                    stroke="#e5e7eb"
                    strokeWidth={1}
                  />
                  <GridColumns
                    scale={xScale}
                    width={innerWidth}
                    height={innerHeight}
                    stroke="#e5e7eb"
                    strokeWidth={1}
                  />

                  {/* All Companies Line - Conversion Time */}
                  <LinePath
                    data={allData}
                    x={(d) => xScale(d.date)}
                    y={(d) => yScale(d.conversionTime)}
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    curve={curveMonotoneX}
                  />

                  {/* Selected Segment Line - Conversion Time */}
                  <LinePath
                    data={currentData}
                    x={(d) => xScale(d.date)}
                    y={(d) => yScale(d.conversionTime)}
                    stroke="#10b981"
                    strokeWidth={2}
                    curve={curveMonotoneX}
                  />

                  {/* All Companies Line - Conversion Rate */}
                  <LinePath
                    data={allData}
                    x={(d) => xScale(d.date)}
                    y={(d) => yScaleRate(d.conversionRate)}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    curve={curveMonotoneX}
                  />

                  {/* Selected Segment Line - Conversion Rate */}
                  <LinePath
                    data={currentData}
                    x={(d) => xScale(d.date)}
                    y={(d) => yScaleRate(d.conversionRate)}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    curve={curveMonotoneX}
                  />

                  <AxisLeft
                    scale={yScale}
                    stroke="#6b7280"
                    tickStroke="#6b7280"
                    tickLabelProps={() => ({
                      fill: "#6b7280",
                      fontSize: 12,
                      textAnchor: "end",
                      dy: "0.33em",
                    })}
                  />
                  <AxisBottom
                    scale={xScale}
                    top={innerHeight}
                    stroke="#6b7280"
                    tickStroke="#6b7280"
                    tickLabelProps={() => ({
                      fill: "#6b7280",
                      fontSize: 12,
                      textAnchor: "middle",
                    })}
                  />
                </Group>
              </svg>
            </div>

            {/* Legend */}
            <div className="mt-4 flex justify-center">
              <div className="flex flex-col gap-2">
                {legendItems.map((item) => (
                  <div key={item.label} className="flex gap-4">
                    {activeTab === "all" ? (
                      <div className="flex items-center gap-2">
                        <svg width="20" height="2">
                          <line
                            x1="0"
                            y1="1"
                            x2="20"
                            y2="1"
                            stroke={item.color}
                            strokeWidth="2"
                          />
                        </svg>
                        <span className="text-xs text-gray-600">
                          {item.label} (All)
                        </span>
                      </div>
                    ) : (
                      item.styles.map((style, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <svg width="20" height="2">
                            <line
                              x1="0"
                              y1="1"
                              x2="20"
                              y2="1"
                              stroke={item.color}
                              strokeWidth="2"
                              strokeDasharray={style.isDotted ? "4 4" : "0"}
                            />
                          </svg>
                          <span className="text-xs text-gray-600">
                            {item.label} ({style.label})
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Settings Panel */}
        <div
          className={`absolute top-0 right-0 w-[400px] h-full transition-all duration-300 ease-in-out bg-white ${
            showSettings ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <Card className="h-full p-4 bg-transparent border-gray-100 shadow-none rounded-none">
            <h2 className="text-sm font-medium text-gray-500 mb-3">Flow</h2>

            {/* Flow Steps */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 p-2 border border-gray-100">
                <Database className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Postgres New Tenant - Any Event</span>
              </div>
              <div className="flex items-center gap-2 p-2 border border-gray-100">
                <CreditCard className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Stripe Subscription Created</span>
              </div>
            </div>

            {/* Graph Type Selector */}
            <div className="flex gap-1.5 mb-4">
              <div className="flex items-center gap-1.5 text-emerald-600 px-2 py-1 border border-emerald-100">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">conversion time</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600 px-2 py-1 border border-gray-100">
                <BarChart2 className="h-3.5 w-3.5" />
                <span className="text-xs">steps</span>
              </div>
              <div className="flex items-center gap-1.5 text-blue-600 px-2 py-1 border border-blue-100">
                <CheckCircle className="h-3.5 w-3.5" />
                <span className="text-xs">completion rate</span>
              </div>
            </div>

            {/* Group Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">Group</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 border border-gray-100">
                  <svg
                    className="h-4 w-4 text-blue-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 12a3 3 0 106 0 3 3 0 00-6 0z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7 19V5M17 19V5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-sm">Hubspot Company Size</span>
                </div>

                <div className="flex flex-wrap gap-1.5 p-2 border border-gray-100 min-h-[32px] rounded-none">
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 h-6 px-2 text-xs"
                  >
                    0-50
                    <button className="hover:text-gray-500">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 h-6 px-2 text-xs"
                  >
                    50-200
                    <button className="hover:text-gray-500">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 h-6 px-2 text-xs"
                  >
                    200+
                    <button className="hover:text-gray-500">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
