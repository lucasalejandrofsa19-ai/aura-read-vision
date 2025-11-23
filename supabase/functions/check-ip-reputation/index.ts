import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReputationCheckRequest {
  ipAddress: string;
  maxAgeInDays?: number;
}

interface AbuseIPDBResponse {
  data: {
    ipAddress: string;
    isPublic: boolean;
    ipVersion: number;
    isWhitelisted: boolean;
    abuseConfidenceScore: number;
    countryCode: string;
    usageType: string;
    isp: string;
    domain: string;
    totalReports: number;
    numDistinctUsers: number;
    lastReportedAt: string;
    reports: Array<{
      reportedAt: string;
      comment: string;
      categories: number[];
      reporterId: number;
      reporterCountryCode: string;
    }>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    const { ipAddress, maxAgeInDays = 90 }: ReputationCheckRequest = await req.json();
    
    if (!ipAddress) {
      throw new Error('IP address is required');
    }

    console.log(`[CHECK-REPUTATION] Checking IP: ${ipAddress}`);

    const abuseIPDBKey = Deno.env.get('ABUSEIPDB_API_KEY');
    if (!abuseIPDBKey) {
      throw new Error('AbuseIPDB API key not configured');
    }

    // Check AbuseIPDB API
    const response = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ipAddress)}&maxAgeInDays=${maxAgeInDays}&verbose`,
      {
        method: 'GET',
        headers: {
          'Key': abuseIPDBKey,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CHECK-REPUTATION] AbuseIPDB API error:', errorText);
      throw new Error(`AbuseIPDB API error: ${response.status}`);
    }

    const data: AbuseIPDBResponse = await response.json();
    const ipData = data.data;

    console.log(`[CHECK-REPUTATION] IP ${ipAddress} score: ${ipData.abuseConfidenceScore}`);

    // Categorize threat level
    const isThreat = ipData.abuseConfidenceScore >= 25; // 25+ is considered suspicious
    const threatLevel = ipData.abuseConfidenceScore >= 75 ? 'high' :
                       ipData.abuseConfidenceScore >= 50 ? 'medium' :
                       ipData.abuseConfidenceScore >= 25 ? 'low' : 'none';

    // Map category numbers to names
    const categoryMap: Record<number, string> = {
      1: 'DNS Compromise',
      2: 'DNS Poisoning',
      3: 'Fraud Orders',
      4: 'DDoS Attack',
      5: 'FTP Brute-Force',
      6: 'Ping of Death',
      7: 'Phishing',
      8: 'Fraud VoIP',
      9: 'Open Proxy',
      10: 'Web Spam',
      11: 'Email Spam',
      12: 'Blog Spam',
      13: 'VPN IP',
      14: 'Port Scan',
      15: 'Hacking',
      16: 'SQL Injection',
      17: 'Spoofing',
      18: 'Brute-Force',
      19: 'Bad Web Bot',
      20: 'Exploited Host',
      21: 'Web App Attack',
      22: 'SSH',
      23: 'IoT Targeted',
    };

    // Extract unique categories from reports
    const categorySet = new Set<string>();
    ipData.reports?.forEach(report => {
      report.categories.forEach(cat => {
        if (categoryMap[cat]) {
          categorySet.add(categoryMap[cat]);
        }
      });
    });
    const threatCategories = Array.from(categorySet);

    const reputationData = {
      ipAddress: ipData.ipAddress,
      abuseConfidenceScore: ipData.abuseConfidenceScore,
      isThreat,
      threatLevel,
      threatCategories,
      countryCode: ipData.countryCode,
      usageType: ipData.usageType,
      isp: ipData.isp,
      domain: ipData.domain,
      totalReports: ipData.totalReports,
      numDistinctUsers: ipData.numDistinctUsers,
      lastReportedAt: ipData.lastReportedAt,
      isWhitelisted: ipData.isWhitelisted,
      checkedAt: new Date().toISOString(),
    };

    console.log(`[CHECK-REPUTATION] Reputation check complete for ${ipAddress}:`, {
      score: ipData.abuseConfidenceScore,
      isThreat,
      threatLevel,
      categories: threatCategories,
    });

    return new Response(
      JSON.stringify({
        success: true,
        reputation: reputationData,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[CHECK-REPUTATION] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
