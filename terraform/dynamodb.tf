resource "aws_dynamodb_table" "tracker" {
  name           = "${var.project_name}-tracker"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name = "${var.project_name}-tracker"
  }
}
