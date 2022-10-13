'use strict';

(() => {
	// Comment preview popovers.
	document.querySelectorAll('.preview').forEach((el) => {
		el.addEventListener('click', () => {
			el.dataset.bsContent =
				el.parentNode.querySelector('textarea')?.value.replace(/</g, '< ').replace(/>/g, ' >');
			if (el.dataset.bsContent) {
				const popover = new bootstrap.Popover(el, {
					html: true, trigger: 'focus', placement: 'bottom', delay: { show: 0, hide: 200 }
				});
				el.addEventListener('hidden.bs.popover', () => popover.dispose(), { once: true });
				popover.show();
				if (window.MathJax) {
					MathJax.startup.promise = MathJax.startup.promise.then(
						() => MathJax.typesetPromise(['.popover-body'])
					);
				}
			}
		});
	});

	// Check all button for the general problem grader.
	document.getElementById('check_all_mark_corrects')?.addEventListener('click', () =>
		document.querySelectorAll('.mark_correct').forEach((check) => {
			if (check.checked) check.checked = false;
			else check.checked = true;
		})
	);

	// Compute the problem score from any answer sub scores, and update the problem score input.
	document.querySelectorAll('.answer-part-score').forEach((part) => {
		part.addEventListener('input', () => {
			const problemId = part.dataset.problemId;
			const answerLabels = JSON.parse(part.dataset.answerLabels);

			if (!part.checkValidity()) part.classList.add('is-invalid');
			else part.classList.remove('is-invalid');

			let score = 0;
			answerLabels.forEach((label) => {
				const partElt = document.getElementById(`score_problem${problemId}_${label}`);
				score += partElt.value * partElt.dataset.weight;
			});
			document.getElementById(`score_problem${problemId}`).value = Math.round(score);
			document.getElementById(`grader_messages_problem${problemId}`).innerHTML = '';
		});
	});

	// Clear messages when the score or comment are changed.
	document.querySelectorAll('.problem-score,.grader-problem-comment').forEach((el) => {
		el.addEventListener('input', () => {
			if (!el.checkValidity()) el.classList.add('is-invalid');
			else el.classList.remove('is-invalid');

			document.getElementById(`grader_messages_problem${el.dataset.problemId}`).innerHTML = '';
		});
	});

	// Save the score and comment.
	document.querySelectorAll('.save-grade').forEach((saveButton) => {
		saveButton.addEventListener('click', async () => {
			const saveData = saveButton.dataset;

			const user = document.getElementById('hidden_user').value;
			const sessionKey = document.getElementById('hidden_key').value;

			const messageArea = document.getElementById(`grader_messages_problem${saveData.problemId}`);

			const scoreInput = document.getElementById('score_problem' + saveData.problemId);
			if (!scoreInput.checkValidity()) {
				messageArea.classList.add('alert-danger');
				messageArea.textContent = scoreInput.validationMessage;
				setTimeout(() => messageArea.classList.remove('alert-danger'), 100);
				scoreInput.focus();
				return;
			}

			// Save the score.
			const basicWebserviceURL = `${webworkConfig?.webwork_url ?? '/webwork2'}/instructor_rpc`;

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000);

			try {
				const response = await fetch(basicWebserviceURL, {
					method: 'post',
					mode: 'same-origin',
					body: new URLSearchParams({
						user: user,
						session_key: sessionKey,
						rpc_command: saveData.versionId !== '0' ? 'putProblemVersion' : 'putUserProblem',
						courseID: saveData.courseId,
						user_id: saveData.studentId,
						set_id: saveData.setId,
						version_id: saveData.versionId,
						problem_id: saveData.problemId,
						status: parseInt(scoreInput.value) / 100
					}),
					signal: controller.signal
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					throw 'Unknown server communication error.';
				} else {
					const data = await response.json();
					if (data.error) {
						throw data.error;
					} else {
						// Update the hidden problem status fields and score table for gateway quizzes
						if (saveData.versionId !== '0') {
							for (const scoreCell of document.querySelectorAll(
								`table.gwNavigation td.score[data-problem-id="${saveData.problemId}"]`)) {
								scoreCell.textContent = scoreInput.value == '100' ? '\u{1F4AF}' : scoreInput.value;
							}
							document.gwquiz.elements['probstatus' + saveData.problemId].value =
								parseInt(scoreInput.value) / 100;
						}

						if (saveData.pastAnswerId !== '0') {
							// Save the comment.
							const comment = document.getElementById(`comment_problem${saveData.problemId}`)?.value;

							const controller = new AbortController();
							const timeoutId = setTimeout(() => controller.abort(), 10000);

							try {
								const response = await fetch(basicWebserviceURL, {
									method: 'post',
									body: new URLSearchParams({
										user: user,
										session_key: sessionKey,
										rpc_command: 'putPastAnswer',
										courseID: saveData.courseId,
										answer_id: saveData.pastAnswerId,
										comment_string: comment
									}),
									signal: controller.signal
								});

								clearTimeout(timeoutId);

								if (!response.ok) {
									throw 'Unknown server communication error.';
								} else {
									const data = await response.json();
									if (data.error) {
										throw data.error;
									} else {
										messageArea.classList.add('alert-success');
										messageArea.textContent = 'Score and comment saved.';
										setTimeout(() => messageArea.classList.remove('alert-success'), 100);
									}
								}
							} catch (e) {
								messageArea.classList.add('alert-danger');
								messageArea.innerHTML =
									'<div>The score was saved, but there was an error saving the comment.</div>' +
									`<div>${e}</div>`;
								setTimeout(() => messageArea.classList.remove('alert-danger', 100));
							}
						} else {
							messageArea.classList.add('alert-success');
							messageArea.textContent = 'Score saved.';
							setTimeout(() => messageArea.classList.remove('alert-success'), 100);
						}
					}
				}
			} catch (e) {
				messageArea.classList.add('alert-danger');
				messageArea.innerHTML = `<div>Error saving score.</div><div>${e?.message ?? e}</div>`;
				setTimeout(() => messageArea.classList.remove('alert-danger', 100));
			}
		});
	})
})();
