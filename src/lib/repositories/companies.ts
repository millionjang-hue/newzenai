import { query, queryOne } from "@/lib/db";
import type { Company, Contact } from "@/lib/types";

export interface CompanyRow extends Company {
  contact_count: number;
  open_deal_count: number;
  open_value: number;
  won_value: number;
}

export function listCompanies(search = ""): Promise<CompanyRow[]> {
  const like = `%${search.trim()}%`;
  return query<CompanyRow>(
    `SELECT c.*,
            (SELECT COUNT(*)::int FROM contacts ct WHERE ct.company_id = c.id) AS contact_count,
            (SELECT COUNT(*)::int FROM deals d WHERE d.company_id = c.id AND d.status = 'open') AS open_deal_count,
            (SELECT COALESCE(SUM(d.amount), 0) FROM deals d WHERE d.company_id = c.id AND d.status = 'open') AS open_value,
            (SELECT COALESCE(SUM(d.amount), 0) FROM deals d WHERE d.company_id = c.id AND d.status = 'won') AS won_value
       FROM companies c
      WHERE (? = '' OR c.name LIKE ? OR c.industry LIKE ? OR c.domain LIKE ?)
      ORDER BY won_value DESC, open_value DESC, c.name`,
    [search.trim(), like, like, like],
  );
}

export function getCompany(id: string): Promise<Company | null> {
  return queryOne<Company>(`SELECT * FROM companies WHERE id = ?`, [id]);
}

export interface ContactRow extends Contact {
  company_name: string | null;
  open_deal_count: number;
}

export function listContacts(search = ""): Promise<ContactRow[]> {
  const like = `%${search.trim()}%`;
  return query<ContactRow>(
    `SELECT ct.*,
            co.name AS company_name,
            (SELECT COUNT(*)::int FROM deals d WHERE d.contact_id = ct.id AND d.status = 'open') AS open_deal_count
       FROM contacts ct
       LEFT JOIN companies co ON co.id = ct.company_id
      WHERE (? = ''
             OR ct.first_name LIKE ? OR ct.last_name LIKE ?
             OR ct.email LIKE ? OR co.name LIKE ?)
      ORDER BY ct.is_primary DESC, co.name, ct.last_name`,
    [search.trim(), like, like, like, like],
  );
}
