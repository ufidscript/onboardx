param(
  [string]$ApiUrl = "http://localhost:3000",
  [string]$UiUrl = "http://localhost:5178"
)

function Check-Health {
  try {
    $h = Invoke-RestMethod -UseBasicParsing "$ApiUrl/api/health" -ErrorAction Stop -TimeoutSec 10
    Write-Host "HEALTH: status=$($h.status) memories=$($h.memories) chunks=$($h.chunks) ollama=$($h.ollama)"
    return $true
  } catch {
    Write-Host "Health check failed: $($_.Exception.Message)"
    return $false
  }
}

function Ask($q) {
  try {
    $body = @{ question = $q } | ConvertTo-Json
    $res = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/ask" -ContentType 'application/json' -Body $body -ErrorAction Stop -TimeoutSec 120
    Write-Host "\nQUESTION: $q"
    Write-Host "STATUS: $($res.status)"
    if ($res.answer) { Write-Host "ANSWER:`n$($res.answer)`n" } else { Write-Host "ANSWER: <none>`n" }
    Write-Host "CITATION_IDS: $(@($res.citation_ids) -join ', ')`n"
    if ($res.citations) {
      Write-Host "Resolved citations (first 200 chars):"
      foreach ($c in $res.citations) {
        $excerpt = $c.content
        if ($null -ne $excerpt) { $snippet = $excerpt.Substring(0,[math]::Min(200,$excerpt.Length)) } else { $snippet = '' }
        Write-Host "- $($c.memory_title) [$($c.chunk_id)]`n  $snippet`n"
      }
    }
  } catch {
    Write-Host "Ask failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
      try { $body = (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd(); Write-Host "RESPONSE BODY:`n$body" } catch { }
    }
  }
}

Write-Host "Running OnboardX smoke tests..."
Write-Host "UI: $UiUrl"
Write-Host "API: $ApiUrl\n"

if (-not (Check-Health)) { Write-Host "API health failed — ensure server is running on $ApiUrl"; exit 1 }

# Answerable / expected to match sample content in demo data
Ask "When did installation problems delay the start?"

# Unanswerable / expected insufficient evidence
Ask "What is the server password?"

Write-Host "Smoke tests complete."