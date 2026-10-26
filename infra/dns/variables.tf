variable "state_passphrase" {
  description = "Passphrase der Verschlüsselung von State und Plan (Secret TF_STATE_PASSPHRASE)."
  type        = string
  sensitive   = true
}

variable "zone" {
  description = "Bestehende DNS-Zone (z. B. project-suite.ch)."
  type        = string
  default     = "project-suite.ch"
}

variable "record_name" {
  description = "Name des Eintrags in der Zone (ppm → ppm.project-suite.ch)."
  type        = string
  default     = "ppm"
}

variable "app_ipv4" {
  description = "Öffentliche IPv4 der App-VM (Ausgabe app_ipv4 von infra/hetzner)."
  type        = string
}

variable "app_ipv6" {
  description = "Öffentliche IPv6 der App-VM (Ausgabe app_ipv6 von infra/hetzner); leer = kein AAAA."
  type        = string
  default     = ""
}

variable "ttl" {
  description = "TTL der Einträge in Sekunden."
  type        = number
  default     = 300
}

variable "caa_issuer" {
  description = "Zertifizierungsstelle im CAA-Eintrag (Caddy holt Zertifikate per ACME); leer = kein CAA."
  type        = string
  default     = "letsencrypt.org"
}
