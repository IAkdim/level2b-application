import { supabase } from "./supabaseClient"

/**
 * Helper function to build organization-scoped queries
 * Automatically adds org_id filter to queries
 */
export function withOrgFilter(query: any, orgId: string) {
  return query.eq("org_id", orgId)
}

/**
 * Fetch data from a table filtered by organization
 */
export async function getOrgData(
  table: string,
  orgId: string,
  select: string = "*",
  additionalFilters?: (query: any) => any
) {
  let query = supabase.from(table).select(select).eq("org_id", orgId)

  if (additionalFilters) {
    query = additionalFilters(query)
  }

  return query
}

/**
 * Insert data with org_id automatically included
 */
export async function insertOrgData(
  table: string,
  orgId: string,
  data: Record<string, any> | Record<string, any>[]
) {
  const dataWithOrg = Array.isArray(data)
    ? data.map((item) => ({ ...item, org_id: orgId }))
    : { ...data, org_id: orgId }

  return supabase.from(table).insert(dataWithOrg).select()
}

/**
 * Update data in a table filtered by organization
 */
export async function updateOrgData(
  table: string,
  orgId: string,
  id: string,
  updates: Record<string, any>
) {
  return supabase
    .from(table)
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
}

/**
 * Delete data from a table filtered by organization
 */
export async function deleteOrgData(
  table: string,
  orgId: string,
  id: string
) {
  return supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
}

/**
 * Get a single record by ID, scoped to organization
 */
export async function getOrgRecord(
  table: string,
  orgId: string,
  id: string,
  select: string = "*"
) {
  return supabase
    .from(table)
    .select(select)
    .eq("id", id)
    .eq("org_id", orgId)
    .single()
}
