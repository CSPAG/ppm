# App-VM (Caddy, api, worker, mcp mit Docker Compose) und DB-VM (PostgreSQL 17 mit pgBackRest, Volume), privates
# Netz, Firewalls. Bucket für pgBackRest und State legt der Betrieb in Hetzner Object Storage an (nicht über diesen
# Provider).

locals {
  labels     = merge({ app = "ppm", managed-by = "opentofu" }, var.labels)
  network_id = var.existing_network_name == "" ? hcloud_network.ppm[0].id : data.hcloud_network.existing[0].id
}

data "hcloud_ssh_key" "betrieb" {
  for_each = toset(var.ssh_key_names)
  name     = each.value
}

resource "hcloud_ssh_key" "deploy" {
  name       = "${var.name_prefix}-deploy"
  public_key = var.deploy_ssh_public_key
  labels     = local.labels
}

# --- Netz

data "hcloud_network" "existing" {
  count = var.existing_network_name == "" ? 0 : 1
  name  = var.existing_network_name
}

resource "hcloud_network" "ppm" {
  count    = var.existing_network_name == "" ? 1 : 0
  name     = "${var.name_prefix}-net"
  ip_range = var.network_ip_range
  labels   = local.labels
}

resource "hcloud_network_subnet" "ppm" {
  network_id   = local.network_id
  type         = "cloud"
  network_zone = var.network_zone
  ip_range     = var.subnet_ip_range
}

# --- Firewalls (gelten nur für öffentliche Schnittstellen; das private Netz regelt pg_hba.conf)

resource "hcloud_firewall" "app" {
  name   = "${var.name_prefix}-app"
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
  rule {
    description = "SSH (Betrieb, Deploy)"
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = var.admin_cidrs
  }
}

resource "hcloud_firewall" "db" {
  name   = "${var.name_prefix}-db"
  labels = local.labels

  rule {
    description = "SSH (Betrieb)"
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = var.admin_cidrs
  }
}

resource "hcloud_placement_group" "ppm" {
  name   = "${var.name_prefix}-spread"
  type   = "spread"
  labels = local.labels
}

# --- DB-VM

resource "hcloud_volume" "pgdata" {
  name              = "${var.name_prefix}-pgdata"
  location          = var.location
  size              = var.db_volume_size
  format            = "ext4"
  delete_protection = true
  labels            = local.labels
}

resource "hcloud_server" "db" {
  name               = "${var.name_prefix}-db"
  server_type        = var.db_server_type
  image              = var.image
  location           = var.location
  placement_group_id = hcloud_placement_group.ppm.id
  firewall_ids       = [hcloud_firewall.db.id]
  ssh_keys           = concat([hcloud_ssh_key.deploy.id], [for k in data.hcloud_ssh_key.betrieb : k.id])
  delete_protection  = true
  rebuild_protection = true
  backups            = true
  labels             = merge(local.labels, { role = "db" })

  user_data = templatefile("${path.module}/cloud-init/db.yaml.tftpl", {
    deploy_ssh_public_key = var.deploy_ssh_public_key
    volume_device         = hcloud_volume.pgdata.linux_device
  })

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  network {
    network_id = local.network_id
    ip         = var.db_private_ip
  }

  depends_on = [hcloud_network_subnet.ppm]

  lifecycle {
    ignore_changes = [user_data, image, ssh_keys]
  }
}

resource "hcloud_volume_attachment" "pgdata" {
  volume_id = hcloud_volume.pgdata.id
  server_id = hcloud_server.db.id
  automount = false
}

# --- App-VM

resource "hcloud_server" "app" {
  name               = "${var.name_prefix}-app"
  server_type        = var.app_server_type
  image              = var.image
  location           = var.location
  placement_group_id = hcloud_placement_group.ppm.id
  firewall_ids       = [hcloud_firewall.app.id]
  ssh_keys           = concat([hcloud_ssh_key.deploy.id], [for k in data.hcloud_ssh_key.betrieb : k.id])
  rebuild_protection = true
  labels             = merge(local.labels, { role = "app" })

  user_data = templatefile("${path.module}/cloud-init/app.yaml.tftpl", {
    deploy_ssh_public_key = var.deploy_ssh_public_key
  })

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  network {
    network_id = local.network_id
    ip         = var.app_private_ip
  }

  depends_on = [hcloud_network_subnet.ppm]

  lifecycle {
    ignore_changes = [user_data, image, ssh_keys]
  }
}
