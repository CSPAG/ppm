output "app_ipv4" {
  description = "Öffentliche IPv4 der App-VM (DNS A bei Infomaniak, infra/dns)."
  value       = hcloud_server.app.ipv4_address
}

output "app_ipv6" {
  description = "Öffentliche IPv6 der App-VM (DNS AAAA bei Infomaniak, infra/dns)."
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

output "dns" {
  description = "Soll-Einträge für infra/dns (Infomaniak): Zone und Einträge mit Namen relativ zur Zone."
  value = {
    zone    = var.dns_zone
    records = local.dns_records
  }
}

output "dns_records_text" {
  description = "Dieselben Einträge als Zonendatei-Zeilen (zur Kontrolle)."
  value = join("\n", [
    for r in local.dns_records : format("%-40s %6d IN %-5s %s", "${r.name}.${var.dns_zone}.", r.ttl, r.type, r.value)
  ])
}
