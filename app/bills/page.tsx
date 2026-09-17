"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SegmentedControl, Skeleton } from "@westy/shared/ui";
import type { Bill } from "@westy/shared";
import { AppNav } from "@/components/AppNav";
import { mockWestyClient, PROVIDER_DIRECTORY } from "@/lib/mock";
import { BillsListStatusTag, billFinancials, billTitle, formatMoney, formatShortDate } from "@/lib/bills";

type BillRow = {
  bill: Bill;
  memberName: string;
  title: string;
  date: string;
  billed: number;
  insurancePaid: number | null;
  owe: number;
};

type Filter = "all" | Bill["status"];

export default function Bills() {
  const [rows, setRows] = useState<BillRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await mockWestyClient.getCurrentUser();
      const me = await mockWestyClient.getPerson(user.personId);
      const members = await mockWestyClient.listHouseholdMembers(me.householdId);
      const byMember = await Promise.all(
        members.map(async (member) => {
          const bills = await mockWestyClient.listBills(member.id);
          const withCharges = await Promise.all(
            bills.map(async (bill) => {
              const charges = await mockWestyClient.getCharges(bill.chargeIds);
              const { billed, insurancePaid, owe } = billFinancials(charges);
              return {
                bill,
                memberName: `${member.firstName} ${member.lastName}`,
                title: billTitle(charges, PROVIDER_DIRECTORY),
                date: formatShortDate(charges[0]?.serviceDate ?? bill.id),
                billed,
                insurancePaid,
                owe,
              };
            })
          );
          return withCharges;
        })
      );
      if (!cancelled) setRows(byMember.flat());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRows = rows?.filter((row) => filter === "all" || row.bill.status === filter) ?? [];

  return (
    <>
      <AppNav
        brand="Westy"
        links={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bills", href: "/bills", active: true },
          { label: "Household", href: "/household" },
          { label: "Connections", href: "/connections" },
          { label: "Ask Westy", href: "/ask-westy" },
        ]}
      />
      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Bills</h1>
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            Every bill across the household — what&apos;s billed, what insurance paid, and what&apos;s left.
          </p>
        </div>

        {!rows ? (
          <>
            <Skeleton height={36} width={340} />
            <Skeleton height={200} />
          </>
        ) : (
          <>
            <SegmentedControl
              name="billFilter"
              value={filter}
              onChange={(value) => setFilter(value as Filter)}
              options={[
                { value: "all", label: "All" },
                { value: "pending", label: "Pending" },
                { value: "flagged", label: "Flagged" },
                { value: "paid", label: "Paid" },
                { value: "disputed", label: "Disputed" },
              ]}
            />

            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Family member</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Billed</th>
                    <th style={{ textAlign: "right" }}>Insurance paid</th>
                    <th style={{ textAlign: "right" }}>You owe</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.bill.id}>
                      <td>
                        <Link href={`/bills/${row.bill.id}`} style={{ textDecoration: "none" }}>
                          {row.title}
                        </Link>
                      </td>
                      <td>{row.memberName}</td>
                      <td className="text-muted">{row.date}</td>
                      <td style={{ textAlign: "right" }}>{formatMoney(row.billed)}</td>
                      <td style={{ textAlign: "right" }}>
                        {row.insurancePaid === null ? "—" : formatMoney(row.insurancePaid)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(row.owe)}</td>
                      <td>
                        <BillsListStatusTag status={row.bill.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: 12, opacity: 0.5 }}>
              Pending = waiting on insurance to process. Flagged = Westy found a gap worth a second look. Disputed =
              an appeal or dispute is in progress.
            </p>
          </>
        )}
      </main>
    </>
  );
}
