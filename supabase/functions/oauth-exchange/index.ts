import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Platform token exchange helpers ─────────────────────────────────────────

interface TokenResult {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  accountName: string;
  accountHandle: string | null;
  externalAccountId: string | null;
  avatarUrl: string | null;
  scopes: string | null;
}

async function exchangeInstagram(
  code: string,
  redirectUri: string,
): Promise<TokenResult> {
  const clientId = Deno.env.get("INSTAGRAM_CLIENT_ID")!;
  const clientSecret = Deno.env.get("INSTAGRAM_CLIENT_SECRET")!;

  // Step 1: Short-lived User Access Token via Facebook
  const tokenRes = await fetch("https://graph.facebook.com/v20.0/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Facebook token exchange failed: ${err}`);
  }
  const { access_token: shortToken } = await tokenRes.json();

  // Step 2: Exchange for long-lived User Access Token (~60 days)
  const llRes = await fetch(
    `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(shortToken)}`,
  );
  if (!llRes.ok) throw new Error(`Long-lived token exchange failed: ${await llRes.text()}`);
  const { access_token: longToken } = await llRes.json();

  // Step 3: Get Facebook Pages managed by the user
  const pagesRes = await fetch(
    `https://graph.facebook.com/v20.0/me/accounts?access_token=${encodeURIComponent(longToken)}`,
  );
  if (!pagesRes.ok) throw new Error(`Failed to fetch Facebook Pages: ${await pagesRes.text()}`);
  const pagesData = await pagesRes.json();
  const pages: Array<{ id: string; name: string; access_token: string }> =
    pagesData.data ?? [];

  if (pages.length === 0) {
    throw new Error(
      "No Facebook Pages found. Your Instagram must be a Professional account linked to a Facebook Page.",
    );
  }

  // Step 4: Find a Page with a linked Instagram Business or Creator Account
  let igAccountId: string | null = null;
  let igUsername: string | null = null;
  let igName: string | null = null;
  let igAvatar: string | null = null;
  let pageAccessToken = longToken;

  for (const page of pages) {
    const igRes = await fetch(
      `https://graph.facebook.com/v20.0/${page.id}?fields=instagram_business_account` +
        `&access_token=${encodeURIComponent(page.access_token)}`,
    );
    const igData = await igRes.json();
    if (igData.instagram_business_account?.id) {
      igAccountId = igData.instagram_business_account.id;
      pageAccessToken = page.access_token;

      // Step 5: Fetch Instagram profile
      const profileRes = await fetch(
        `https://graph.facebook.com/v20.0/${igAccountId}` +
          `?fields=id,username,name,profile_picture_url` +
          `&access_token=${encodeURIComponent(pageAccessToken)}`,
      );
      const profile = await profileRes.json();
      igUsername = profile.username ?? null;
      igName = profile.name ?? null;
      igAvatar = profile.profile_picture_url ?? null;
      break;
    }
  }

  if (!igAccountId) {
    throw new Error(
      "No Instagram Business or Creator account linked to your Facebook Pages. " +
        "Please link your Instagram to a Facebook Page in Instagram Settings first.",
    );
  }

  return {
    accessToken: pageAccessToken, // Page Access Tokens don't expire
    refreshToken: null,
    expiresAt: null,
    accountName: igName ?? igUsername ?? `instagram_${igAccountId}`,
    accountHandle: igUsername,
    externalAccountId: igAccountId,
    avatarUrl: igAvatar,
    scopes: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
  };
}

async function exchangeFacebook(params: {
  code?: string;
  redirectUri?: string;
  accessToken?: string;
}): Promise<TokenResult> {
  // Facebook and Instagram share the same Meta app — fall back to Instagram credentials.
  const clientId =
    Deno.env.get("FACEBOOK_CLIENT_ID") ?? Deno.env.get("INSTAGRAM_CLIENT_ID");
  const clientSecret =
    Deno.env.get("FACEBOOK_CLIENT_SECRET") ?? Deno.env.get("INSTAGRAM_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Missing Facebook OAuth credentials (FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET)");
  }

  let shortToken: string;

  if (params.accessToken) {
    // Implicit flow: Business Login returned access_token directly in the hash fragment.
    // Use it as the short-lived token and proceed to the long-lived exchange.
    shortToken = params.accessToken;
  } else if (params.code && params.redirectUri) {
    // Code flow: exchange authorization code for a short-lived user access token.
    const tokenRes = await fetch("https://graph.facebook.com/v20.0/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: params.redirectUri,
        code: params.code,
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Facebook token exchange failed: ${err}`);
    }
    const { access_token } = await tokenRes.json();
    shortToken = access_token;
  } else {
    throw new Error("Either code+redirectUri or accessToken is required for Facebook exchange");
  }

  // Exchange for long-lived User Access Token (~60 days)
  const llRes = await fetch(
    `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(shortToken)}`,
  );
  if (!llRes.ok) {
    throw new Error(`Facebook long-lived token exchange failed: ${await llRes.text()}`);
  }
  const { access_token: longToken } = await llRes.json();

  // Get Facebook Pages managed by the user
  const pagesRes = await fetch(
    `https://graph.facebook.com/v20.0/me/accounts?access_token=${encodeURIComponent(longToken)}`,
  );
  if (!pagesRes.ok) {
    throw new Error(`Failed to fetch Facebook Pages: ${await pagesRes.text()}`);
  }
  const pagesData = await pagesRes.json();
  const pages: Array<{ id: string; name: string; access_token: string }> =
    pagesData.data ?? [];

  if (pages.length === 0) {
    throw new Error(
      "No Facebook Pages found. Please create a Facebook Page and grant admin access, " +
        "then reconnect. Pages are required to publish content via Facebook.",
    );
  }

  // Use the first page (the Meta Business Login dialog lets the user pick which page to share)
  const page = pages[0];

  return {
    accessToken: longToken, // stored so publish-facebook can call /me/accounts at publish time
    refreshToken: null,
    expiresAt: null, // long-lived tokens don't carry an expiry in the exchange response
    accountName: page.name,
    accountHandle: page.id,
    externalAccountId: page.id,
    avatarUrl: null,
    scopes: "pages_manage_posts,pages_read_engagement,pages_show_list",
  };
}

async function exchangePinterest(
  code: string,
  redirectUri: string,
): Promise<TokenResult> {
  const clientId = Deno.env.get("PINTEREST_CLIENT_ID")!;
  const clientSecret = Deno.env.get("PINTEREST_CLIENT_SECRET")!;

  const tokenRes = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Pinterest token exchange failed: ${await tokenRes.text()}`);
  const tokens = await tokenRes.json();

  const profileRes = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt,
    accountName: profile.username ?? "Pinterest Account",
    accountHandle: profile.username ?? null,
    externalAccountId: profile.id ?? null,
    avatarUrl: profile.profile_image ?? null,
    scopes: tokens.scope ?? null,
  };
}

async function exchangeGeneric(
  platform: string,
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<TokenResult> {
  const configs: Record<string, {
    tokenUrl: string;
    profileUrl: string;
    clientIdEnv: string;
    clientSecretEnv: string;
    nameField: string;
    handleField: string;
    idField: string;
    avatarField: string | null;
    scopeValue: string;
  }> = {
    facebook: {
      tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
      profileUrl: "https://graph.facebook.com/me?fields=id,name,picture",
      clientIdEnv: "FACEBOOK_CLIENT_ID",
      clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
      nameField: "name",
      handleField: "id",
      idField: "id",
      avatarField: null,
      scopeValue: "pages_manage_posts",
    },
    tiktok: {
      tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
      profileUrl: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
      clientIdEnv: "TIKTOK_CLIENT_KEY",
      clientSecretEnv: "TIKTOK_CLIENT_SECRET",
      nameField: "display_name",
      handleField: "display_name",
      idField: "open_id",
      avatarField: "avatar_url",
      scopeValue: "user.info.basic",
    },
    x: {
      tokenUrl: "https://api.twitter.com/2/oauth2/token",
      profileUrl: "https://api.twitter.com/2/users/me",
      clientIdEnv: "X_CLIENT_ID",
      clientSecretEnv: "X_CLIENT_SECRET",
      nameField: "name",
      handleField: "username",
      idField: "id",
      avatarField: null,
      scopeValue: "tweet.read tweet.write",
    },
    linkedin: {
      tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      profileUrl: "https://api.linkedin.com/v2/userinfo",
      clientIdEnv: "LINKEDIN_CLIENT_ID",
      clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
      nameField: "name",
      handleField: "email",
      idField: "sub",
      avatarField: "picture",
      scopeValue: "openid profile w_member_social",
    },
    youtube: {
      tokenUrl: "https://oauth2.googleapis.com/token",
      profileUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
      clientIdEnv: "GOOGLE_CLIENT_ID",
      clientSecretEnv: "GOOGLE_CLIENT_SECRET",
      nameField: "name",
      handleField: "email",
      idField: "sub",
      avatarField: "picture",
      scopeValue: "youtube",
    },
    threads: {
      tokenUrl: "https://graph.threads.net/oauth/access_token",
      profileUrl: "https://graph.threads.net/me?fields=id,username,name",
      clientIdEnv: "THREADS_CLIENT_ID",
      clientSecretEnv: "THREADS_CLIENT_SECRET",
      nameField: "name",
      handleField: "username",
      idField: "id",
      avatarField: null,
      scopeValue: "threads_basic",
    },
    snapchat: {
      tokenUrl: "https://accounts.snapchat.com/accounts/oauth2/token",
      profileUrl: "https://kit.snapchat.com/v1/me?query={me{externalId displayName profileLink bitmoji{avatarImage{url}}}}",
      clientIdEnv: "SNAPCHAT_CLIENT_ID",
      clientSecretEnv: "SNAPCHAT_CLIENT_SECRET",
      nameField: "displayName",
      handleField: "displayName",
      idField: "externalId",
      avatarField: null,
      scopeValue: "snapchat-marketing-api",
    },
  };

  const cfg = configs[platform];
  if (!cfg) throw new Error(`Unsupported platform: ${platform}`);

  const clientId = Deno.env.get(cfg.clientIdEnv);
  const clientSecret = Deno.env.get(cfg.clientSecretEnv);
  if (!clientId || !clientSecret) {
    throw new Error(`Missing OAuth credentials for ${platform}`);
  }

  const bodyParams: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  };
  if (codeVerifier) bodyParams["code_verifier"] = codeVerifier;

  const tokenRes = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(bodyParams),
  });
  if (!tokenRes.ok) {
    throw new Error(`${platform} token exchange failed: ${await tokenRes.text()}`);
  }
  const tokens = await tokenRes.json();

  // Fetch profile
  const profileRes = await fetch(cfg.profileUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  // Resolve nested data (TikTok wraps in data.user)
  const profileData = profile.data?.user ?? profile;

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt,
    accountName: profileData[cfg.nameField] ?? `${platform} account`,
    accountHandle: profileData[cfg.handleField] ?? null,
    externalAccountId: profileData[cfg.idField] ? String(profileData[cfg.idField]) : null,
    avatarUrl: cfg.avatarField ? profileData[cfg.avatarField] ?? null : null,
    scopes: tokens.scope ?? cfg.scopeValue,
  };
}

// ── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Edge Function entry point ────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { platform, code, accessToken, workspaceId, redirectUri, codeVerifier } =
      await req.json() as {
        platform: string;
        code?: string;
        accessToken?: string;
        workspaceId: string;
        redirectUri?: string;
        codeVerifier?: string;
      };

    // For non-Facebook platforms the code+redirectUri pair is always required.
    // Facebook also accepts a direct accessToken from the implicit flow.
    const isFacebookImplicit = platform === "facebook" && !!accessToken;
    if (!platform || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: platform, workspaceId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!isFacebookImplicit && (!code || !redirectUri)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code, redirectUri" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify the user is a member of the workspace
    const { data: membership } = await serviceClient
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Workspace access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange the authorization code (or direct token) for stored credentials
    let result: TokenResult;
    if (platform === "instagram") {
      result = await exchangeInstagram(code!, redirectUri!);
    } else if (platform === "facebook") {
      result = await exchangeFacebook({ code, redirectUri, accessToken });
    } else if (platform === "pinterest") {
      result = await exchangePinterest(code!, redirectUri!);
    } else {
      result = await exchangeGeneric(platform, code!, redirectUri!, codeVerifier);
    }

    // Upsert into social_accounts
    const { data: account, error: upsertError } = await serviceClient
      .from("social_accounts")
      .upsert(
        {
          workspace_id: workspaceId,
          platform: platform as never,
          account_name: result.accountName,
          account_identifier: result.accountHandle,
          external_account_id: result.externalAccountId,
          avatar_url: result.avatarUrl,
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          token_expires_at: result.expiresAt,
          scopes: result.scopes,
          status: "active",
        },
        {
          onConflict: "workspace_id,platform",
          ignoreDuplicates: false,
        },
      )
      .select("id, account_name, account_identifier, avatar_url, token_expires_at, status")
      .single();

    if (upsertError) {
      throw new Error(`DB upsert failed: ${upsertError.message} (code: ${upsertError.code})`);
    }

    return new Response(JSON.stringify({ success: true, account }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : (err as any)?.message ?? JSON.stringify(err) ?? "OAuth exchange failed";
    console.error("[oauth-exchange]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
