import os

os.environ['EXECUTION_API_KEY'] = 'test'

import server


def assert_blocked(code: str) -> None:
    err = server.validate_python(code)
    assert err is not None, code


def test_import_escapes_are_blocked():
    assert_blocked('import os\ndef f(): return os.system("id")')
    assert_blocked('from os import system\ndef f(): return system("id")')
    assert_blocked('import runpy\ndef f(): return runpy.run_module("os")["system"]("id")')
    assert_blocked('import importlib\ndef f(): return importlib.import_module("os")')


def test_reflection_is_blocked():
    assert_blocked('def f(): return ().__class__.__base__.__subclasses__()')
    assert_blocked('def f(): return globals()["__builtins__"]')
    assert_blocked('def f(): return getattr(object, "__subclasses__")()')


def test_safe_function_executes():
    result = server.run_python(
        'def add(a, b): return a + b',
        [{'function': 'add', 'args': [2, 3], 'expected': 5}],
        1000,
    )
    assert result['ok'] is True
    assert result['result']['passed'] == 1
    assert result['result']['total'] == 1


def test_empty_tests_are_not_a_pass():
    result = server.run_python('def add(a, b): return a + b', [], 1000)
    assert result['ok'] is True
    assert result['result']['passed'] == 0
    assert result['result']['total'] == 0


if __name__ == '__main__':
    test_import_escapes_are_blocked()
    test_reflection_is_blocked()
    test_safe_function_executes()
    test_empty_tests_are_not_a_pass()
    print('runner regression tests passed')
