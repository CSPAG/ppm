output "app_ipv4" {
  description = "Öffentliche IPv4 der App-VM (DNS A-Record bei Hostpoint)."
  value       = hcloud_server.app.ipv4_address
}

output "app_ipv6" {
  description = "Öffentliche IPv6 der App-VM (DNS AAAA-Record bei Hostpoint)."
  value       = hcloud_server.app.ipv6_address
}

output "db_private_ip" {
  description = "Private Adresse der DB-VM (DATABASE_URL, nur im privaten Netz)."
  value       = var.db_private_ip
}

output "pgdata_volume_device" {
  description = "Gerät des Daten-Volumes auf der DB-VM."
  value       = hcloud_volume.pgdata.linux_device
}
