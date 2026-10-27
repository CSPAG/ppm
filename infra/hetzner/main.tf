# Umgebung von PPM in einem eigenen Hetzner-Projekt:
#   App-VM (öffentlich 80/443, Caddy + Container) ─ privates Netz ─ DB-VM (nur privat, PostgreSQL 17, pgBackRest)
# Backups und PITR: pgBackRest in einen Object-Storage-Bucket (deploy/hetzner/db/); Buckets legt Hetzner Object Storage
# an (nicht über die Cloud-API), Namen stehen in deploy/hetzner/README.md.

locals {
  labels = { app = "ppm", managed_by = "opentofu" }
}

resource "hcloud_ssh_key" "ops" {
  for_each   = var.ssh_keys
  name       = "ppm-${each.key}"
  public_key = each.value
  labels     = local.labels
}

resource "hcloud_network" "main" {
  name              = "ppm"
  ip_range          = var.private_network_cidr
  delete_protection = var.delete_protection
  labels            = local.labels
}

resource "hcloud_network_subnet" "servers" {
  network_id   = hcloud_network.main.id
  type         = "cloud"
  network_zone = var.network_zone
  ip_range     = cidrsubnet(var.private_network_cidr, 8, 1) # 10.0.1.0/24
}

resource "hcloud_firewall" "app" {
  name   = "ppm-app"
  labels = local.labels

  rule {
    description = "HTTP (ACME, Weiterleitung auf HTTPS)"
    direction   = "in"
    protocol    = "tcp"
    port        = "80"
    source_ips  = ["0.0.0.0/0", "::/0"]
  }
  rule {
    description = "HTTPS"
    direction   = "in"
    protocol    = "tcp"
    port        = "443"
    source_ips  = ["0.0.0.0/0", "::/0"]
  }
  rule {
    description = "HTTP/3"
    direction   = "in"
    protocol    = "udp"
    port        = "443"
    source_ips  = ["0.0.0.0/0", "::/0"]
  }
  dynamic "rule" {
    for_each = length(var.admin_cidrs) > 0 ? [1] : []
    content {
      description = "SSH der Betriebspersonen"
      direction   = "in"
      protocol    = "tcp"
      port        = "22"
      source_ips  = var.admin_cidrs
    }
  }
}

# DB-VM: von aussen nichts (auch kein SSH; Zugang über die App-VM als Sprungserver)
resource "hcloud_firewall" "db" {
  name   = "ppm-db"
  labels = local.labels
}

resource "hcloud_server" "app" {
  name               = "ppm-app"
  server_type        = var.app_server_type
  image              = var.image
  location           = var.location
  ssh_keys           = [for k in hcloud_ssh_key.ops : k.id]
  firewall_ids       = [hcloud_firewall.app.id]
  delete_protection  = var.delete_protection
  rebuild_protection = var.delete_protection
  labels             = merge(local.labels, { role = "app" })
  user_data          = file("${path.module}/cloud-init/app.yaml")

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }
  network {
    network_id = hcloud_network.main.id
    ip         = var.app_private_ip
  }
  depends_on = [hcloud_network_subnet.servers]
  lifecycle {
    ignore_changes = [user_data, image]
  }
}

resource "hcloud_server" "db" {
  name               = "ppm-db"
  server_type        = var.db_server_type
  image              = var.image
  location           = var.location
  ssh_keys           = [for k in hcloud_ssh_key.ops : k.id]
  firewall_ids       = [hcloud_firewall.db.id]
  delete_protection  = var.delete_protection
  rebuild_protection = var.delete_protection
  labels             = merge(local.labels, { role = "db" })
  user_data          = file("${path.module}/cloud-init/db.yaml")

  # Ausgehend braucht die DB-VM IPv4 (Pakete, Object Storage für pgBackRest); eingehend sperrt die Firewall alles
  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }
  network {
    network_id = hcloud_network.main.id
    ip         = var.db_private_ip
  }
  depends_on = [hcloud_network_subnet.servers]
  lifecycle {
    ignore_changes = [user_data, image]
  }
}

resource "hcloud_volume" "pgdata" {
  name              = "ppm-pgdata"
  size              = var.db_volume_size
  location          = var.location
  format            = "ext4"
  delete_protection = var.delete_protection
  labels            = local.labels
}

resource "hcloud_volume_attachment" "pgdata" {
  volume_id = hcloud_volume.pgdata.id
  server_id = hcloud_server.db.id
  automount = true
}
