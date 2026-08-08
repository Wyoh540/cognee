from pathlib import Path

from cognee.base_config import BaseConfig


def test_cognee_home_contains_default_persistent_directories(tmp_path, monkeypatch):
    monkeypatch.setenv("COGNEE_HOME", str(tmp_path))
    monkeypatch.delenv("DATA_ROOT_DIRECTORY", raising=False)
    monkeypatch.delenv("SYSTEM_ROOT_DIRECTORY", raising=False)
    monkeypatch.delenv("CACHE_ROOT_DIRECTORY", raising=False)
    monkeypatch.delenv("COGNEE_LOGS_DIR", raising=False)

    config = BaseConfig(_env_file=None)

    assert Path(config.cognee_root_directory) == tmp_path
    assert Path(config.data_root_directory) == tmp_path / "data"
    assert Path(config.system_root_directory) == tmp_path / "system"
    assert Path(config.cache_root_directory) == tmp_path / "cache"
    assert Path(config.logs_root_directory) == tmp_path / "logs"


def test_specific_persistence_directories_override_cognee_home(tmp_path, monkeypatch):
    root = tmp_path / "root"
    custom_data = tmp_path / "custom-data"
    monkeypatch.setenv("COGNEE_HOME", str(root))
    monkeypatch.setenv("DATA_ROOT_DIRECTORY", str(custom_data))

    config = BaseConfig(_env_file=None)

    assert Path(config.data_root_directory) == custom_data
    assert Path(config.system_root_directory) == root / "system"


def test_cognee_root_directory_alias_is_supported(tmp_path, monkeypatch):
    monkeypatch.delenv("COGNEE_HOME", raising=False)
    monkeypatch.setenv("COGNEE_ROOT_DIRECTORY", str(tmp_path))

    config = BaseConfig(_env_file=None)

    assert Path(config.cognee_root_directory) == tmp_path
    assert Path(config.cache_root_directory) == tmp_path / "cache"
