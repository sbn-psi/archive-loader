
$(document).ready( function() {
    $('.form-group').each(function() {
        setupFormGroupListener($(this));
    });
    $('.repeating-group .form-group').each(function() {
        setupRepeatingGroupListener($(this));
    });
    setGroupFields();
    $('#dataset-form').submit(function() {
        if(validate()) { sanitize() }
        else { return false }
    })

    // specific fields
    const toggleDeliveryInfo = function() {
        if($('#publication-accumulating').is(':checked')) {
            $('label[for="publication-delivery_info"]').show();
            $('#publication-delivery_info').show();
        } else {
            $('label[for="publication-delivery_info"]').hide();
            $('#publication-delivery_info').hide();
        }
    }
    $('#publication-accumulating').change(toggleDeliveryInfo);
    toggleDeliveryInfo();

    const toggleCollectionFields = function() {
        if($("input[name='dataset-type']:checked").val() == 'collection') {
            $('.collection-field').show();
            $('.collection-field :input').removeAttr("disabled");
        } else {
            $('.collection-field').hide();
            $('.collection-field :input').attr("disabled", "disabled");
        }
    }
    $("input[name='dataset-type']").change(toggleCollectionFields);
    toggleCollectionFields();
})

const setupRepeatingGroupListener = function(repeatingGroup) {
    repeatingGroup.children().change(function() {
        copyGroup(repeatingGroup);
    });

}
const setupFormGroupListener = function(formGroup) {
    formGroup.children().change(function() {
        var newVal = $(this).val();
        if(newVal && newVal.length > 0) { 
            formGroup.removeClass('empty');
        }
        else { 
            formGroup.addClass('empty'); 
        }
    });
}

const copyGroup = function(group) {
    var allGroups = group.parent().children('.form-group');
    var lastGroup = allGroups.last();

    emptyGroups = allGroups.filter('.empty');
    if(emptyGroups.length > 1) {
        emptyGroups.first().remove();
        copyGroup(group);
    } else if (emptyGroups.length == 0) {
        var newGroup = group.clone();
        newGroup.addClass('empty');
        setupFormGroupListener(newGroup);
        setupRepeatingGroupListener(newGroup);
        lastGroup.after(newGroup);
        newGroup.children(':input').not(':button, :submit, :reset, :hidden')
            .val('')
            .prop('checked', false)
            .prop('selected', false);
    }
    setGroupFields();
}

const setGroupFields = function() {
    $('.repeating-group .form-group').each(function(index) {
        var elementGroup = $(this);
        var groupFieldName = elementGroup.parent().data('fieldname');
        elementGroup.data('index', index);
        elementGroup.children(':input').each(function() {
            var input = $(this);
            var subFieldName = input.data('fieldname');
            input.attr('name', `${groupFieldName}[${index}]` + (subFieldName ? `[${subFieldName}]` : ''));
        });
    });
}

const validate = function() {
    return true
}
const sanitize = function() {
    $('.form-group.empty').remove();
    $('#dataset-form :input[value=""]').attr("disabled", "disabled");
    console.log($('#dataset-form :input[value=""]').length)
}