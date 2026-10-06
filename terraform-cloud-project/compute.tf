# Look up an AMI instead of hardcoding an ID, because AMI ids differ per region.
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "web" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web.id]

  # runs on first boot
  user_data = <<-EOT
    #!/bin/bash
    dnf install -y nginx
    echo "<h1>Hello from Terraform</h1><p>Prateek Singh, 24BCS10135</p>" > /usr/share/nginx/html/index.html
    systemctl enable --now nginx
  EOT

  tags = {
    Name = "${var.project_name}-web"
  }
}
