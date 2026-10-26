# A/AAAA für den Host der App und CAA (nur die ACME-Stelle von Caddy darf Zertifikate ausstellen).

data "hcloud_zone" "zone" {
  name = var.zone
}

resource "hcloud_zone_rrset" "a" {
  zone    = data.hcloud_zone.zone.name
  name    = var.record_name
  type    = "A"
  ttl     = var.ttl
  records = [{ value = var.app_ipv4 }]
}

resource "hcloud_zone_rrset" "aaaa" {
  count   = var.app_ipv6 == "" ? 0 : 1
  zone    = data.hcloud_zone.zone.name
  name    = var.record_name
  type    = "AAAA"
  ttl     = var.ttl
  records = [{ value = var.app_ipv6 }]
}

resource "hcloud_zone_rrset" "caa" {
  count   = var.caa_issuer == "" ? 0 : 1
  zone    = data.hcloud_zone.zone.name
  name    = var.record_name
  type    = "CAA"
  ttl     = var.ttl
  records = [{ value = "0 issue \"${var.caa_issuer}\"" }]
}
