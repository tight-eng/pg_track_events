"use client";

import {
  ArrowDown,
  ArrowUp,
  Building2,
  Briefcase,
  Factory,
  Store,
  Warehouse,
  Landmark,
  Plane,
  Ship,
  Truck,
  Car,
  Train,
  Bus,
  Bike,
  Rocket,
  Laptop,
  Smartphone,
  Tablet,
  Headphones,
  Camera,
  Printer,
  Settings,
} from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

// Mock data for demonstration
const customers = [
  {
    id: 1,
    name: "TechCorp Solutions",
    icon: Building2,
    seats: 245,
    seatsChange: 12,
    revenue: 45000,
    revenueChange: 5,
    runs: 20000,
    runsChange: 8,
  },
  {
    id: 2,
    name: "Global Logistics",
    icon: Warehouse,
    seats: 189,
    seatsChange: -8,
    revenue: 38000,
    revenueChange: -3,
    runs: 18000,
    runsChange: 12,
  },
  {
    id: 3,
    name: "Retail Masters",
    icon: Store,
    seats: 156,
    seatsChange: 5,
    revenue: 32000,
    revenueChange: 7,
    runs: 15000,
    runsChange: -4,
  },
  {
    id: 4,
    name: "Industrial Systems",
    icon: Factory,
    seats: 132,
    seatsChange: 3,
    revenue: 28000,
    revenueChange: 2,
    runs: 12000,
    runsChange: 6,
  },
  {
    id: 5,
    name: "Business Pro",
    icon: Briefcase,
    seats: 98,
    seatsChange: -2,
    revenue: 22000,
    revenueChange: -1,
    runs: 10000,
    runsChange: 3,
  },
  {
    id: 6,
    name: "Financial Partners",
    icon: Landmark,
    seats: 187,
    seatsChange: 4,
    revenue: 42000,
    revenueChange: 6,
    runs: 19000,
    runsChange: 5,
  },
  {
    id: 7,
    name: "Sky Travel",
    icon: Plane,
    seats: 134,
    seatsChange: 7,
    revenue: 35000,
    revenueChange: 4,
    runs: 16000,
    runsChange: 9,
  },
  {
    id: 8,
    name: "Marine Express",
    icon: Ship,
    seats: 112,
    seatsChange: -3,
    revenue: 29000,
    revenueChange: -2,
    runs: 14000,
    runsChange: 7,
  },
  {
    id: 9,
    name: "Road Warriors",
    icon: Truck,
    seats: 156,
    seatsChange: 6,
    revenue: 33000,
    revenueChange: 3,
    runs: 17000,
    runsChange: 4,
  },
  {
    id: 10,
    name: "Auto Solutions",
    icon: Car,
    seats: 98,
    seatsChange: -1,
    revenue: 25000,
    revenueChange: 2,
    runs: 12000,
    runsChange: 6,
  },
  {
    id: 11,
    name: "Rail Systems",
    icon: Train,
    seats: 145,
    seatsChange: 5,
    revenue: 31000,
    revenueChange: 4,
    runs: 15000,
    runsChange: 8,
  },
  {
    id: 12,
    name: "City Transit",
    icon: Bus,
    seats: 167,
    seatsChange: 3,
    revenue: 34000,
    revenueChange: 5,
    runs: 16000,
    runsChange: 7,
  },
  {
    id: 13,
    name: "Bike Network",
    icon: Bike,
    seats: 89,
    seatsChange: 8,
    revenue: 23000,
    revenueChange: 7,
    runs: 11000,
    runsChange: 9,
  },
  {
    id: 14,
    name: "Space Tech",
    icon: Rocket,
    seats: 123,
    seatsChange: 9,
    revenue: 41000,
    revenueChange: 8,
    runs: 18000,
    runsChange: 10,
  },
  {
    id: 15,
    name: "Digital Systems",
    icon: Laptop,
    seats: 178,
    seatsChange: 4,
    revenue: 37000,
    revenueChange: 6,
    runs: 17000,
    runsChange: 5,
  },
  {
    id: 16,
    name: "Mobile Solutions",
    icon: Smartphone,
    seats: 156,
    seatsChange: 7,
    revenue: 32000,
    revenueChange: 5,
    runs: 15000,
    runsChange: 8,
  },
  {
    id: 17,
    name: "Tablet Tech",
    icon: Tablet,
    seats: 134,
    seatsChange: 3,
    revenue: 28000,
    revenueChange: 4,
    runs: 13000,
    runsChange: 6,
  },
  {
    id: 18,
    name: "Audio Systems",
    icon: Headphones,
    seats: 112,
    seatsChange: 5,
    revenue: 26000,
    revenueChange: 3,
    runs: 12000,
    runsChange: 7,
  },
  {
    id: 19,
    name: "Photo Pro",
    icon: Camera,
    seats: 98,
    seatsChange: 6,
    revenue: 24000,
    revenueChange: 5,
    runs: 11000,
    runsChange: 8,
  },
  {
    id: 20,
    name: "Print Solutions",
    icon: Printer,
    seats: 145,
    seatsChange: 4,
    revenue: 30000,
    revenueChange: 4,
    runs: 14000,
    runsChange: 6,
  },
];

export default function CustomersPage() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Top 20 Customers</h1>
            <p className="text-muted-foreground">
              Understand the usage and growth at our top customers.
            </p>
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Paid Seats</TableHead>
              <TableHead className="text-right">Monthly Revenue</TableHead>
              <TableHead className="text-right">Runs/Month</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow
                key={customer.id}
                className="hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() =>
                  (window.location.href = `/customers/${customer.name
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`)
                }
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <customer.icon className="h-5 w-5 text-muted-foreground" />
                    <span>{customer.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {customer.seats}
                    {customer.seatsChange > 0 ? (
                      <ArrowUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-red-500" />
                    )}
                    <span
                      className={`text-sm ${
                        customer.seatsChange > 0
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {Math.abs(customer.seatsChange)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    ${customer.revenue.toLocaleString()}
                    {customer.revenueChange > 0 ? (
                      <ArrowUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-red-500" />
                    )}
                    <span
                      className={`text-sm ${
                        customer.revenueChange > 0
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {Math.abs(customer.revenueChange)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {customer.runs.toLocaleString()}
                    {customer.runsChange > 0 ? (
                      <ArrowUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-red-500" />
                    )}
                    <span
                      className={`text-sm ${
                        customer.runsChange > 0
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {Math.abs(customer.runsChange)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
