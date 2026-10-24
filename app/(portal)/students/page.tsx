"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useCurrency } from "@/components/portal/currency-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { financialApiFetch, ApiError } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/locale-provider";

interface StudentAccount {
  id: string;
  name: string;
  grade: string;
  creditBalance: number;
  totalPaid: number;
}

export default function StudentsPage() {
  const { money } = useCurrency();
  const { t } = useI18n();
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [filtered, setFiltered] = useState<StudentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await financialApiFetch<StudentAccount[]>("/finance/student-profiles");
      setStudents(data);
      setFiltered(data);
      setError("");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(students);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(students.filter((s) => s.name.toLowerCase().includes(q) || s.grade.toLowerCase().includes(q)));
  }, [search, students]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("students.title")}</h1>
      </div>

      <div className="flex items-center gap-4">
        <Input placeholder={t("students.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : error ? (
        <div className="text-center py-12"><p className="text-destructive text-sm">{error}</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-muted-foreground">{t("students.none")}</p></div>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t("students.profilesCard")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("students.colName")}</TableHead><TableHead>{t("students.colGrade")}</TableHead>
                  <TableHead className="text-right">{t("students.colTotalPaid")}</TableHead>
                  <TableHead className="text-right">{t("students.colCredit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/students/${s.id}`} className="underline-offset-4 hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant="outline">{s.grade}</Badge></TableCell>
                    <TableCell className="text-right text-success">{money(s.totalPaid)}</TableCell>
                    <TableCell className="text-right">
                      {s.creditBalance > 0 ? <span className="text-info font-medium">{money(s.creditBalance)}</span> : <span className="text-muted-foreground">{money(0)}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
