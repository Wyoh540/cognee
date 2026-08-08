from cognee.base_config import BaseConfig


def test_root_directories_can_be_configured_with_environment_variables(monkeypatch, tmp_path):
    data_directory = tmp_path / "data"
    system_directory = tmp_path / "system"
    cache_directory = tmp_path / "cache"

    monkeypatch.setenv("DATA_ROOT_DIRECTORY", str(data_directory))
    monkeypatch.setenv("SYSTEM_ROOT_DIRECTORY", str(system_directory))
    monkeypatch.setenv("CACHE_ROOT_DIRECTORY", str(cache_directory))

    config = BaseConfig(_env_file=None)

    assert config.data_root_directory == str(data_directory.resolve())
    assert config.system_root_directory == str(system_directory.resolve())
    assert config.cache_root_directory == str(cache_directory.resolve())
