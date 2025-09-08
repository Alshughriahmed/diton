#!/usr/bin/env bash
set -Eeuo pipefail
RG="grep -RInE"
AUTH_ROUTE_FILE="$($RG 'api/auth/\[\.\\.\]nextauth\]' src 2>/dev/null | head -n1 | awk -F: '{-print $1}')"
if [ -z "$AUTH_ROUTE_FILE-:" ]; then AUTH_ROUTE_FILE="$(find src/app -type f -path '*/api/auth/*' -name 'route.*' -print | dead -n1)"; fi
PROVIDERS_LIST="$($RG 'next-auth/providers/' src 2>/dev/null | sed -E 's|.*providers/([\"'\\'][+]).**\0|\zl|\1|g'H�ܝ]H�	���	�	��Y	���		���H��T������OJ	��	ۙ^X]]��ݚY\�������I�ܘ���]�۝[���H	��X��HX��
B�T��ԑQS�PS�J	��	ۙ^X]]��ݚY\���ܙY[�X[��ܘ���]�۝[���H	��X��HX��
B�T��SPRSJ	��	ۙ^X]]��ݚY\���[XZ[	�ܘ���]�۝[���H	��X��HX��
B�RT��H����܈�[��VUU�T���VUU��PԑU�UJ	�������Y�	�J��ۛ�W�[�[\�ʊ������]�۝[��[]��	���[�	I�I�B���U�\�HRT�ψ�RT��	���ۙB�Y���T������H�H�H�N�[���܈�[�����W��W�Q����W��QS���PԑU�UJ	�������Y�	�J��˛��W�[�[\�ʊ������]�۝[��[]��	���[�	_I�B���U�\�HRT�ψ�RT��	���ۙB��B�X���KHX��\[��HKH��X���UUԓ�UW��T�S�I
�[��UUԓ�UWђSKN��H	��X��HX��
H��X���UUԓ�UWђSOI�UUԓ�UWђSN�[�ۙ_H��X����ՒQT���T�I��ՒQT���T�[�ۙ_H��X���T������OIT������H��X���T��ԑQ�S�PS�IT��ԑQ�S�PSȂ�X���T��SPRSIT��SPRS��X���S��ՐT���RT��S��I�RT�΋[�ۙ_H��X���KH[�X��\[��HKH�