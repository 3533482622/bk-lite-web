# -- coding: utf-8 --
# @File: add_redis_relation_attrs.py
# Add 6 relation attributes to the Redis model for topology/cluster/sentinel display.
# Run after deploy; then run: python manage.py init_field_groups (for redis to pick up new attrs in groups).

from django.core.management.base import BaseCommand

from apps.cmdb.services.model import ModelManage
from apps.core.exceptions.base_app_exception import BaseAppException


REDIS_MODEL_ID = "redis"

# attr_id, attr_name (display), attr_group for the 6 relation fields
REDIS_RELATION_ATTRS = [
    ("redis_topology_mode", "拓扑模式", "关系信息"),
    ("redis_cluster_uuid", "集群UUID", "关系信息"),
    ("master_group_list", "主从组列表", "关系信息"),
    ("master_group_name", "主从组名", "关系信息"),
    ("slave_set", "从节点集合", "关系信息"),
    ("master_ref", "主节点引用", "关系信息"),
]


class Command(BaseCommand):
    help = "为 Redis 模型添加 6 个关系字段（拓扑/集群/主从），用于采集结果展示。执行后建议运行 init_field_groups。"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="仅打印将要添加的属性，不写入",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        if dry_run:
            self.stdout.write(self.style.WARNING("dry-run: 不写入图库"))

        self.stdout.write(self.style.SUCCESS("开始为 Redis 模型添加关系属性..."))
        added = 0
        skipped = 0
        for attr_id, attr_name, attr_group in REDIS_RELATION_ATTRS:
            attr_info = {
                "attr_id": attr_id,
                "attr_name": attr_name,
                "attr_type": "str",
                "is_required": False,
                "editable": False,
                "is_only": False,
                "attr_group": attr_group,
                "option": None,
                "user_prompt": "",
            }
            if dry_run:
                self.stdout.write(f"  将添加: {attr_id} ({attr_name})")
                added += 1
                continue
            try:
                ModelManage.create_model_attr(REDIS_MODEL_ID, attr_info, username="system")
                self.stdout.write(self.style.SUCCESS(f"  ✓ 已添加: {attr_id} ({attr_name})"))
                added += 1
            except BaseAppException as e:
                if "model attr repetition" in str(e).lower() or "repetition" in str(e).lower():
                    self.stdout.write(self.style.WARNING(f"  跳过(已存在): {attr_id}"))
                    skipped += 1
                else:
                    raise
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  ✗ {attr_id}: {e}"))
                raise

        self.stdout.write(
            self.style.SUCCESS(
                f"\n完成. 添加: {added}, 跳过(已存在): {skipped}. 建议执行: python manage.py init_field_groups"
            )
        )
