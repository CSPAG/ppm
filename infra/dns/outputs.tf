output "fqdn" {
  description = "Vollständiger Name des Hosts."
  value       = "${var.record_name}.${var.zone}"
}
