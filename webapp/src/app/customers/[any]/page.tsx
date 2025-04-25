"use client";

import {
  Warehouse,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  ExternalLink as ExternalLinkIcon,
  ChevronRight,
  Users,
  DollarSign,
  Calendar,
  MessageSquare,
  AlertCircle,
  BarChart2,
  ChevronLeft,
  Clock,
  ExternalLink,
  Play,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { scaleLinear, scaleTime } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { GridRows, GridColumns } from "@visx/grid";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { Group } from "@visx/group";
import { curveMonotoneX } from "@visx/curve";
import { ParentSize } from "@visx/responsive";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";

const ExternalLinkItem = ({ icon, text, href }: any) => (
  <a
    href={href}
    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border hover:bg-muted/50 transition-colors text-xs leading-none"
  >
    <div className="flex items-center gap-1.5">
      <div className="p-0.5 rounded-sm bg-muted/50">{icon}</div>
      <span className="font-medium">{text}</span>
    </div>
  </a>
);

const StatCard = ({ icon, label, value, change }: any) => (
  <Card className="p-4">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-md bg-muted/50">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-xl font-semibold">{value}</p>
          {change && (
            <Badge
              variant={change > 0 ? "secondary" : "destructive"}
              className="flex items-center gap-1"
            >
              {change > 0 ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {Math.abs(change)}%
            </Badge>
          )}
        </div>
      </div>
    </div>
  </Card>
);

const data = Array.from({ length: 24 }, (_, i) => {
  const date = new Date();
  date.setMonth(date.getMonth() - (23 - i));
  // Base growth with some random spikes
  const baseGrowth = 50 * Math.pow(1.3, i);
  const spike = Math.random() > 0.7 ? Math.random() * 0.5 + 0.5 : 0; // 30% chance of spike
  const runs = Math.round(baseGrowth * (1 + spike));
  return {
    date,
    runs,
    // Average customer growth (slower)
    avgRuns: Math.round(50 * Math.pow(1.15, i)),
  };
});

const UsageChart = ({ width, height }: { width: number; height: number }) => {
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = scaleTime({
    range: [0, innerWidth],
    domain: [data[0].date, data[data.length - 1].date],
  });

  const yScale = scaleLinear({
    range: [innerHeight, 0],
    domain: [0, Math.max(...data.map((d) => Math.max(d.runs, d.avgRuns)))],
  });

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Monthly CI Runs</h3>
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={yScale}
            width={innerWidth}
            height={innerHeight}
            stroke="#e2e8f0"
            strokeOpacity={0.2}
          />
          <GridColumns
            scale={xScale}
            width={innerWidth}
            height={innerHeight}
            stroke="#e2e8f0"
            strokeOpacity={0.2}
          />
          {/* Average customer line */}
          <LinePath
            data={data}
            x={(d) => xScale(d.date)}
            y={(d) => yScale(d.avgRuns)}
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            curve={curveMonotoneX}
          />
          {/* Customer line */}
          <LinePath
            data={data}
            x={(d) => xScale(d.date)}
            y={(d) => yScale(d.runs)}
            stroke="#3b82f6"
            strokeWidth={2}
            curve={curveMonotoneX}
          />
          <AxisLeft
            scale={yScale}
            stroke="#94a3b8"
            tickStroke="#94a3b8"
            tickLabelProps={() => ({
              fill: "#64748b",
              fontSize: 12,
              textAnchor: "end",
              dy: "0.33em",
              dx: "-0.33em",
            })}
          />
          <AxisBottom
            scale={xScale}
            stroke="#94a3b8"
            tickStroke="#94a3b8"
            top={innerHeight}
            tickLabelProps={() => ({
              fill: "#64748b",
              fontSize: 12,
              textAnchor: "middle",
            })}
          />
        </Group>
      </svg>
    </div>
  );
};

const mockUsers = [
  {
    id: 1,
    name: "Sarah Chen",
    email: "sarah.chen@globallogistics.com",
    role: "Admin",
    lastLogin: 1,
    loginsPerMonth: 198,
  },
  {
    id: 2,
    name: "Michael Rodriguez",
    email: "michael.rodriguez@globallogistics.com",
    role: "User",
    lastLogin: 2,
    loginsPerMonth: 156,
  },
  {
    id: 3,
    name: "Emily Johnson",
    email: "emily.johnson@globallogistics.com",
    role: "Read-Only",
    lastLogin: 5,
    loginsPerMonth: 45,
  },
  {
    id: 4,
    name: "David Kim",
    email: "david.kim@globallogistics.com",
    role: "Admin",
    lastLogin: 1,
    loginsPerMonth: 187,
  },
  {
    id: 5,
    name: "Lisa Patel",
    email: "lisa.patel@globallogistics.com",
    role: "User",
    lastLogin: 3,
    loginsPerMonth: 132,
  },
  {
    id: 6,
    name: "James Wilson",
    email: "james.wilson@globallogistics.com",
    role: "Read-Only",
    lastLogin: 7,
    loginsPerMonth: 28,
  },
  {
    id: 7,
    name: "Olivia Martinez",
    email: "olivia.martinez@globallogistics.com",
    role: "User",
    lastLogin: 1,
    loginsPerMonth: 167,
  },
  {
    id: 8,
    name: "Ethan Thompson",
    email: "ethan.thompson@globallogistics.com",
    role: "Admin",
    lastLogin: 2,
    loginsPerMonth: 189,
  },
  {
    id: 9,
    name: "Ava Nguyen",
    email: "ava.nguyen@globallogistics.com",
    role: "User",
    lastLogin: 4,
    loginsPerMonth: 145,
  },
  {
    id: 10,
    name: "Noah Garcia",
    email: "noah.garcia@globallogistics.com",
    role: "Read-Only",
    lastLogin: 6,
    loginsPerMonth: 32,
  },
  {
    id: 11,
    name: "Sophia Lee",
    email: "sophia.lee@globallogistics.com",
    role: "User",
    lastLogin: 1,
    loginsPerMonth: 178,
  },
  {
    id: 12,
    name: "Liam Anderson",
    email: "liam.anderson@globallogistics.com",
    role: "Admin",
    lastLogin: 2,
    loginsPerMonth: 195,
  },
  {
    id: 13,
    name: "Isabella Taylor",
    email: "isabella.taylor@globallogistics.com",
    role: "User",
    lastLogin: 3,
    loginsPerMonth: 156,
  },
  {
    id: 14,
    name: "Mason Brown",
    email: "mason.brown@globallogistics.com",
    role: "Read-Only",
    lastLogin: 8,
    loginsPerMonth: 42,
  },
  {
    id: 15,
    name: "Mia Williams",
    email: "mia.williams@globallogistics.com",
    role: "User",
    lastLogin: 1,
    loginsPerMonth: 165,
  },
  {
    id: 16,
    name: "Benjamin Davis",
    email: "benjamin.davis@globallogistics.com",
    role: "Admin",
    lastLogin: 2,
    loginsPerMonth: 187,
  },
  {
    id: 17,
    name: "Charlotte Moore",
    email: "charlotte.moore@globallogistics.com",
    role: "User",
    lastLogin: 4,
    loginsPerMonth: 134,
  },
  {
    id: 18,
    name: "Alexander White",
    email: "alexander.white@globallogistics.com",
    role: "Read-Only",
    lastLogin: 5,
    loginsPerMonth: 38,
  },
  {
    id: 19,
    name: "Amelia Jackson",
    email: "amelia.jackson@globallogistics.com",
    role: "User",
    lastLogin: 1,
    loginsPerMonth: 176,
  },
  {
    id: 20,
    name: "Daniel Harris",
    email: "daniel.harris@globallogistics.com",
    role: "Admin",
    lastLogin: 2,
    loginsPerMonth: 192,
  },
];

const UsersTable = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // Show all users on first page
  const totalPages = Math.ceil(mockUsers.length / itemsPerPage);
  const currentUsers = mockUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">User Management</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Sessions / Month</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      user.role === "Admin"
                        ? "default"
                        : user.role === "User"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>{user.lastLogin} days ago</TableCell>
                <TableCell className="text-right">
                  {user.loginsPerMonth}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

interface RevenueDataPoint {
  date: Date;
  mrr: number;
  cumulative: number;
  arr: number;
  paymentDays: number;
}

const generateRevenueData = (): RevenueDataPoint[] => {
  const data: RevenueDataPoint[] = [];
  const baseRevenue = 38000;

  for (let i = 0; i < 24; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - (23 - i));

    // 3% monthly growth with seasonal variation
    const seasonalFactor = 1 + Math.sin((i * Math.PI) / 6) * 0.05; // ±5% seasonal variation
    const growth = baseRevenue * Math.pow(1.03, i) * seasonalFactor;
    const randomFactor = 1 + (Math.random() * 0.1 - 0.05); // ±5% random variation
    const mrr = Math.round(growth * randomFactor);

    data.push({
      date,
      mrr,
      cumulative: i === 0 ? mrr : mrr + data[i - 1].cumulative,
      arr: mrr * 12,
      paymentDays: 13 + Math.round(Math.random() * 4 - 2), // 11-15 days
    });
  }

  return data;
};

const revenueData = generateRevenueData();

const RevenueCharts = () => {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">Revenue Metrics</h3>
        <div className="flex items-center gap-1 text-green-500">
          <ArrowUp className="h-4 w-4" />
          <span className="text-sm font-medium">+12.3%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MRR Chart */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <h4 className="font-medium">Monthly Recurring Revenue</h4>
              <p className="text-sm text-muted-foreground">
                Current: $
                {revenueData[revenueData.length - 1].mrr.toLocaleString()}
              </p>
            </div>
            <div className="h-[200px]">
              <ParentSize>
                {({ width, height }) => (
                  <LineChart
                    data={revenueData}
                    width={width}
                    height={height}
                    yAccessor={(d) => d.mrr}
                    color="#3b82f6"
                  />
                )}
              </ParentSize>
            </div>
          </CardContent>
        </Card>

        {/* ARR Chart */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <h4 className="font-medium">Annual Recurring Revenue</h4>
              <p className="text-sm text-muted-foreground">
                Current: $
                {revenueData[revenueData.length - 1].arr.toLocaleString()}
              </p>
            </div>
            <div className="h-[200px]">
              <ParentSize>
                {({ width, height }) => (
                  <LineChart
                    data={revenueData}
                    width={width}
                    height={height}
                    yAccessor={(d) => d.arr}
                    color="#10b981"
                  />
                )}
              </ParentSize>
            </div>
          </CardContent>
        </Card>

        {/* Cumulative Revenue Chart */}
        <Card className="md:col-span-2">
          <CardContent className="p-6">
            <div className="mb-4">
              <h4 className="font-medium">Cumulative Revenue</h4>
              <p className="text-sm text-muted-foreground">
                Total: $
                {revenueData[
                  revenueData.length - 1
                ].cumulative.toLocaleString()}
              </p>
            </div>
            <div className="h-[200px]">
              <ParentSize>
                {({ width, height }) => (
                  <LineChart
                    data={revenueData}
                    width={width}
                    height={height}
                    yAccessor={(d) => d.cumulative}
                    color="#8b5cf6"
                  />
                )}
              </ParentSize>
            </div>
          </CardContent>
        </Card>

        {/* Payment Days Chart */}
        <Card className="md:col-span-2">
          <CardContent className="p-6">
            <div className="mb-4">
              <h4 className="font-medium">Average Time to Pay</h4>
              <p className="text-sm text-muted-foreground">
                Last Payment: {revenueData[revenueData.length - 1].paymentDays}{" "}
                days
              </p>
            </div>
            <div className="h-[200px]">
              <ParentSize>
                {({ width, height }) => (
                  <LineChart
                    data={revenueData}
                    width={width}
                    height={height}
                    yAccessor={(d) => d.paymentDays}
                    color="#f59e0b"
                    showGrid={false}
                  />
                )}
              </ParentSize>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface LineChartProps {
  data: RevenueDataPoint[];
  width: number;
  height: number;
  yAccessor: (d: RevenueDataPoint) => number;
  color: string;
  showGrid?: boolean;
}

const LineChart = ({
  data,
  width,
  height,
  yAccessor,
  color,
  showGrid = true,
}: LineChartProps) => {
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = scaleTime({
    range: [0, innerWidth],
    domain: [data[0].date, data[data.length - 1].date],
  });

  const yScale = scaleLinear({
    range: [innerHeight, 0],
    domain: [0, Math.max(...data.map((d) => yAccessor(d)))],
  });

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {showGrid && (
          <>
            <GridRows
              scale={yScale}
              width={innerWidth}
              height={innerHeight}
              stroke="#e2e8f0"
              strokeOpacity={0.2}
            />
            <GridColumns
              scale={xScale}
              width={innerWidth}
              height={innerHeight}
              stroke="#e2e8f0"
              strokeOpacity={0.2}
            />
          </>
        )}
        <LinePath
          data={data}
          x={(d) => xScale(d.date)}
          y={(d) => yScale(yAccessor(d))}
          stroke={color}
          strokeWidth={2}
          curve={curveMonotoneX}
        />
        <AxisLeft
          scale={yScale}
          stroke="#94a3b8"
          tickStroke="#94a3b8"
          tickLabelProps={() => ({
            fill: "#64748b",
            fontSize: 12,
            textAnchor: "end",
            dy: "0.33em",
            dx: "-0.33em",
          })}
        />
        <AxisBottom
          scale={xScale}
          stroke="#94a3b8"
          tickStroke="#94a3b8"
          top={innerHeight}
          tickLabelProps={() => ({
            fill: "#64748b",
            fontSize: 12,
            textAnchor: "middle",
          })}
        />
      </Group>
    </svg>
  );
};

interface ErrorEvent {
  id: string;
  timestamp: Date;
  title: string;
  description: string;
  type: "error" | "warning";
  sentryId: string;
  sessionId: string;
}

const mockErrors: ErrorEvent[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    title: "Database Connection Timeout",
    description: "Failed to establish connection to primary database cluster",
    type: "error",
    sentryId: "sentry-12345",
    sessionId: "session-abc123",
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    title: "API Rate Limit Exceeded",
    description: "Too many requests to external API service",
    type: "warning",
    sentryId: "sentry-12346",
    sessionId: "session-def456",
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    title: "Memory Leak Detected",
    description: "Application memory usage growing steadily",
    type: "warning",
    sentryId: "sentry-12347",
    sessionId: "session-ghi789",
  },
  {
    id: "4",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    title: "Payment Processing Failed",
    description: "Stripe API returned 500 error during transaction",
    type: "error",
    sentryId: "sentry-12348",
    sessionId: "session-jkl012",
  },
  {
    id: "5",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 24 hours ago
    title: "Cache Invalidation Error",
    description: "Redis cache failed to invalidate expired keys",
    type: "warning",
    sentryId: "sentry-12349",
    sessionId: "session-mno345",
  },
  {
    id: "6",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 1 week ago
    title: "Service Degradation",
    description: "Response times increased by 200%",
    type: "warning",
    sentryId: "sentry-12350",
    sessionId: "session-pqr678",
  },
];

const ErrorTimeline = () => {
  // Group errors by week
  const groupedErrors = mockErrors.reduce((acc, error) => {
    const weekStart = new Date(error.timestamp);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)

    const weekKey = weekStart.toISOString();
    if (!acc[weekKey]) {
      acc[weekKey] = [];
    }
    acc[weekKey].push(error);
    return acc;
  }, {} as Record<string, ErrorEvent[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">Error Timeline</h3>
      </div>

      <Card className="bg-muted/50 border-0">
        <CardContent className="p-6">
          <div className="space-y-8">
            {Object.entries(groupedErrors).map(([weekStart, errors]) => (
              <div key={weekStart} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <h4 className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                    Week of{" "}
                    {new Date(weekStart).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                    })}
                  </h4>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-muted/50 to-transparent z-10" />
                  <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-muted/50 to-transparent z-10" />

                  <div className="overflow-x-auto pb-4 -mx-4 px-4">
                    <div className="flex gap-4 min-w-max">
                      {errors.map((error) => (
                        <Card
                          key={error.id}
                          className="w-[320px] flex-shrink-0"
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div
                                className={`p-2 rounded-md ${
                                  error.type === "error"
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-yellow-500/10 text-yellow-500"
                                }`}
                              >
                                <AlertCircle className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">
                                  {error.title}
                                </h4>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {error.description}
                                </p>
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {error.timestamp.toLocaleDateString(
                                      undefined,
                                      {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )}
                                  </span>
                                </div>
                                <div className="flex gap-2 mt-3 flex-wrap">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7 flex-1 justify-start"
                                    asChild
                                  >
                                    <a
                                      href={`https://sentry.io/issues/${error.sentryId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      View in Sentry
                                    </a>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7 flex-1 justify-start"
                                    asChild
                                  >
                                    <a
                                      href={`/session-replay/${error.sessionId}`}
                                    >
                                      <Play className="h-3 w-3 mr-1" />
                                      View Session Replay
                                    </a>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function CustomerPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-muted/50">
          <Warehouse className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Global Logistics
          </h1>
          <p className="text-muted-foreground">
            Enterprise Customer • ID: GL-1892
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Active Seats"
          value="189"
          change={-8}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Monthly Revenue"
          value="$38,000"
          change={-3}
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Customer For"
          value="22 months"
        />
      </div>

      {/* External Links */}
      <div className="flex flex-wrap gap-2">
        <ExternalLinkItem
          icon={<img src="/hubspot.jpeg" className="w-4 h-4" alt="Hubspot" />}
          text="Hubspot Record"
          href="#"
        />
        <ExternalLinkItem
          icon={
            <img src="/stripe_logo.jpeg" className="w-4 h-4" alt="Stripe" />
          }
          text="Stripe Record"
          href="#"
        />
        <ExternalLinkItem
          icon={<img src="/slack.jpeg" className="w-4 h-4" alt="Slack" />}
          text="Slack Channel"
          href="#"
        />
      </div>

      {/* Warning Card */}
      <Alert
        variant="destructive"
        className="border-destructive/50 bg-destructive/5"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <AlertTitle className="text-destructive mt-2">
              Contract Renewal Warning
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <div>
                <p className="text-sm text-destructive/70">
                  Auto-Renew disabled by{" "}
                  <a href="#" className="text-blue-500 underline">
                    Alan Green
                  </a>{" "}
                  on March 9th, 2025
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                View Change Event
              </Button>
            </AlertDescription>
          </div>
        </div>
      </Alert>

      {/* Tabs */}
      <Tabs defaultValue="usage" className="w-full">
        <TabsList className="w-full justify-start gap-5 bg-transparent p-0 h-12">
          <TabsTrigger
            value="usage"
            className="flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-medium"
          >
            <BarChart2 className="h-4 w-4" />
            Usage
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-medium"
          >
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger
            value="revenue"
            className="flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-medium"
          >
            <DollarSign className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger
            value="errors"
            className="flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-medium"
          >
            <AlertCircle className="h-4 w-4" />
            Errors
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="usage">
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <div className="h-[400px]">
                  <ParentSize>
                    {({ width, height }) => (
                      <UsageChart width={width} height={height} />
                    )}
                  </ParentSize>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <UsersTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue">
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <RevenueCharts />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors">
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <ErrorTimeline />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coms">
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                Communications content goes here
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
