export interface IAuthTokens {
  auth_token: string;
  refresh_token: string;
}

export interface IDesktopConfig {
  desktop_token: string;
  database_id: string;
  api_url: string;
  ws_url: string;
  access_allowed: boolean;
  subscription_renewal_date: Date | null;
  feature_flags: Record<string, boolean>;
}
