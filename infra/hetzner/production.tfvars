# Werte der ersten Anlage (keine Geheimnisse); Variable HETZNER_TFVARS im Environment production.
# Muss genau so bleiben: ein anderer Schlüssel oder Kommentar ersetzt hcloud_ssh_key und damit die Server.
location        = "nbg1"
app_server_type = "cx33"
db_server_type  = "cx33"
db_volume_size  = 40
admin_cidrs     = ["0.0.0.0/0", "::/0"]
ssh_keys = {
  betrieb = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH4f9P42Pxlq5iLlGUKqxnIox8clA/Tam3eKi3wBdSEO betrieb@ppm"
}
deploy_ssh_public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMSspZDx3QKS/8dWTc8InzzmGr0JgohE+Mz0pD5Fwm52 deploy-workflow@ppm"
