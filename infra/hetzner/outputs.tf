output "app_ipv4" {
  description = "Öffentliche IPv4 der App-VM (DNS-Eintrag A, Variable APP_HOST des Deploy-Workflows)."
  value       = hcloud_server.app.ipv4_address
}

output "app_ipv6" {
  description = "Öffentliche IPv6 der App-VM (DNS-Eintrag AAAA)."
  value       = hcloud_server.app.ipv6_address
}

output "db_private_ip" {
  description = "Private Adresse der DB-VM (Ziel der Datenbank-URLs)."
  value       = var.db_private_ip
}

output "db_ipv4" {
  description = "Öffentliche IPv4 der DB-VM (nur SSH aus admin_cidrs)."
  value       = hcloud_server.db.ipv4_address
}
