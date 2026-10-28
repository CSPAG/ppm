# Verwaltet von identity-kit (create-iam-app 0.5.6) – nicht von Hand ändern. Einstellungen: identity.app.json; neu schreiben: npx @vollholz/create-iam-app@0.5.6 sync

output "issuer" {
  description = "OIDC_ISSUER_URL der App."
  value       = module.realm.issuer
}

output "clients" {
  description = "Client-IDs der App (alle vertraulichen mit private_key_jwt)."
  value       = module.realm.clients
}

output "machine_clients" {
  description = "Maschinen-Clients: Organisationen, die sie in der App freigeben müssen."
  value       = module.realm.machine_clients
}
