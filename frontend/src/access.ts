import request from '@/services/request';

export type UserRole =
  | 'product_manager'
  | 'developer'
  | 'tester'
  | 'project_manager'
  | 'admin'
  | 'super_admin';

export interface CurrentUser {
  id: number;
  username: string;
  role: UserRole;
  is_admin_or_above: boolean;
  is_super_admin: boolean;
  qw_userid?: string;
  qw_avatar?: string;
  department?: string;
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  try {
    const response = await request.get('/auth/me/');
    return response.data;
  } catch {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    return null;
  }
}
